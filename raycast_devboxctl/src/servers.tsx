import { Action, ActionPanel, Color, Icon, Keyboard, List } from '@raycast/api';
import { useCachedPromise } from '@raycast/utils';
import { BoxStats, getBoxStats, getDashboardUrl, getServerOverviews, ServerOverview } from './devbox';

const GIGABYTE = 1024 ** 3;

function formatGigabytes(bytes: number) {
	return `${(bytes / GIGABYTE).toFixed(1)} GB`;
}

function usageColor(percent: number) {
	if (percent >= 90) {
		return Color.Red;
	}
	return percent >= 70 ? Color.Yellow : Color.Green;
}

function formatBar(percent: number) {
	const filled = Math.round(percent / 10);
	return `${'▰'.repeat(filled)}${'▱'.repeat(10 - filled)}  ${percent}%`;
}

function formatUptime(seconds: number) {
	const days = Math.floor(seconds / 86400);
	const hours = Math.floor((seconds % 86400) / 3600);
	return days ? `${days} days ${hours} h` : `${hours} h`;
}

function percentOf(part: number, whole: number) {
	return whole ? Math.round((part / whole) * 100) : 0;
}

function UsageLabel({ title, used, total }: { title: string; used: number; total: number }) {
	const percent = percentOf(used, total);
	return (
		<>
			<List.Item.Detail.Metadata.Label
				title={title}
				text={{ value: formatBar(percent), color: usageColor(percent) }}
			/>
			<List.Item.Detail.Metadata.Label
				title=""
				text={`${formatGigabytes(used)} of ${formatGigabytes(total)}`}
			/>
		</>
	);
}

function ServerDetail({ server }: { server: ServerOverview }) {
	const { stats } = server;
	return (
		<List.Item.Detail
			metadata={
				<List.Item.Detail.Metadata>
					<List.Item.Detail.Metadata.Label
						title="Connection"
						icon={{ source: Icon.CircleFilled, tintColor: stats ? Color.Green : Color.Red }}
						text={stats ? `Reachable over ${server.sshTarget}` : 'Unreachable'}
					/>
					{server.error && <List.Item.Detail.Metadata.Label title="Error" text={server.error} />}
					{stats && (
						<>
							<List.Item.Detail.Metadata.Separator />
							<UsageLabel
								title="RAM"
								used={stats.memoryTotal - stats.memoryAvailable}
								total={stats.memoryTotal}
							/>
							{stats.disks.map((disk) => (
								<UsageLabel
									key={disk.mount}
									title={`Disk ${disk.mount}`}
									used={disk.used}
									total={disk.size}
								/>
							))}
							<List.Item.Detail.Metadata.Label
								title="CPU"
								text={`${stats.cores} cores · load ${stats.load.join(' / ')}`}
							/>
							<List.Item.Detail.Metadata.Label title="Uptime" text={formatUptime(stats.uptimeSeconds)} />
						</>
					)}
					<List.Item.Detail.Metadata.Separator />
					<List.Item.Detail.Metadata.Label
						title="Dev boxes"
						text={`${server.devBoxes.total} (${server.devBoxes.active} active)`}
					/>
					<List.Item.Detail.Metadata.Label title="IP address" text={server.ip_address ?? '—'} />
					{server.domain && <List.Item.Detail.Metadata.Label title="Domain" text={server.domain} />}
					<List.Item.Detail.Metadata.Label title="Status in benchspace" text={server.status} />
				</List.Item.Detail.Metadata>
			}
		/>
	);
}

function boxHealthColor(box: BoxStats) {
	if (box.network !== 'UP') {
		return Color.Red;
	}
	return box.guest ? Color.Green : Color.Yellow;
}

function BoxDetail({ box }: { box: BoxStats }) {
	const { guest } = box;
	return (
		<List.Item.Detail
			metadata={
				<List.Item.Detail.Metadata>
					<List.Item.Detail.Metadata.Label
						title="Network"
						icon={{ source: Icon.CircleFilled, tintColor: boxHealthColor(box) }}
						text={
							box.network !== 'UP'
								? 'No network link: running but unreachable'
								: guest
									? 'Connected'
									: 'Link up, but the box did not answer'
						}
					/>
					<List.Item.Detail.Metadata.Separator />
					{guest ? (
						<>
							<UsageLabel
								title="RAM (in box)"
								used={guest.memory_total - guest.memory_available}
								total={guest.memory_total}
							/>
							<UsageLabel title="Disk / (in box)" used={guest.root_used} total={guest.root_size} />
							<List.Item.Detail.Metadata.Label title="Load (in box)" text={String(guest.load)} />
						</>
					) : (
						<List.Item.Detail.Metadata.Label
							title="Memory on host"
							text={formatGigabytes(box.host_memory_bytes)}
						/>
					)}
					<List.Item.Detail.Metadata.Label title="CPU on host" text={`${box.cpu_percent}%`} />
					<List.Item.Detail.Metadata.Label title="Running for" text={formatUptime(box.uptime_seconds)} />
					<List.Item.Detail.Metadata.Label
						title="Disk on host"
						text={formatGigabytes(box.disk_allocated_bytes)}
					/>
					<List.Item.Detail.Metadata.Separator />
					<List.Item.Detail.Metadata.Label title="Slug" text={box.slug} />
					<List.Item.Detail.Metadata.Label title="Owner" text={box.owner ?? 'Not on the dashboard'} />
					<List.Item.Detail.Metadata.Label title="Status on dashboard" text={box.status ?? '—'} />
				</List.Item.Detail.Metadata>
			}
		/>
	);
}

export default function Command() {
	const {
		data: servers = [],
		isLoading,
		revalidate,
	} = useCachedPromise(getServerOverviews, [], {
		failureToastOptions: { title: 'Could not load servers' },
	});
	const { data: dashboardUrl } = useCachedPromise(getDashboardUrl);
	const {
		data: boxes = [],
		isLoading: isLoadingBoxes,
		revalidate: revalidateBoxes,
	} = useCachedPromise(getBoxStats, [], { failureToastOptions: { title: 'Could not load box stats' } });

	function refresh() {
		revalidate();
		revalidateBoxes();
	}

	return (
		<List
			isLoading={isLoading || isLoadingBoxes}
			isShowingDetail
			searchBarPlaceholder="Search servers and boxes"
		>
			<List.Section title="Servers">
				{servers.map((server) => {
					const { stats } = server;
					const summary = stats
						? `RAM ${percentOf(stats.memoryTotal - stats.memoryAvailable, stats.memoryTotal)}% · Disk ${percentOf(stats.disks[0]?.used ?? 0, stats.disks[0]?.size ?? 0)}%`
						: 'unreachable';
					return (
						<List.Item
							key={server.name}
							title={server.name}
							subtitle={summary}
							icon={{ source: Icon.CircleFilled, tintColor: stats ? Color.Green : Color.Red }}
							keywords={[server.ip_address ?? '', server.domain ?? '']}
							detail={<ServerDetail server={server} />}
							actions={
								<ActionPanel>
									{dashboardUrl && (
										<Action.OpenInBrowser
											title="Open in Benchspace"
											url={`${dashboardUrl}/app/server/${encodeURIComponent(server.name)}`}
										/>
									)}
									{server.sshTarget && (
										<Action.CopyToClipboard title="Copy SSH Command" content={`ssh ${server.sshTarget}`} />
									)}
									{server.ip_address && (
										<Action.CopyToClipboard
											title="Copy IP Address"
											content={server.ip_address}
											shortcut={Keyboard.Shortcut.Common.Copy}
										/>
									)}
									<Action
										title="Refresh"
										icon={Icon.ArrowClockwise}
										shortcut={Keyboard.Shortcut.Common.Refresh}
										onAction={refresh}
									/>
								</ActionPanel>
							}
						/>
					);
				})}
			</List.Section>
			<List.Section title="Running boxes" subtitle={boxes.length ? String(boxes.length) : undefined}>
				{boxes.map((box) => {
					const { guest } = box;
					const summary = guest
						? `RAM ${percentOf(guest.memory_total - guest.memory_available, guest.memory_total)}% · CPU ${Math.round(box.cpu_percent)}%`
						: box.network === 'UP'
							? 'not answering'
							: 'unreachable';
					return (
						<List.Item
							key={box.slug}
							title={box.nickname ?? box.slug}
							subtitle={summary}
							icon={{ source: Icon.CircleFilled, tintColor: boxHealthColor(box) }}
							keywords={[box.slug, box.title ?? '', box.owner ?? '']}
							detail={<BoxDetail box={box} />}
							actions={
								<ActionPanel>
									<Action.CopyToClipboard title="Copy SSH Command" content={`ssh ${box.slug}`} />
									<Action.CopyToClipboard
										title="Copy Slug"
										content={box.slug}
										shortcut={Keyboard.Shortcut.Common.CopyName}
									/>
									<Action
										title="Refresh"
										icon={Icon.ArrowClockwise}
										shortcut={Keyboard.Shortcut.Common.Refresh}
										onAction={refresh}
									/>
								</ActionPanel>
							}
						/>
					);
				})}
			</List.Section>
		</List>
	);
}
