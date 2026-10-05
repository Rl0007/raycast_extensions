import { Action, ActionPanel, Color, Icon, Keyboard, List } from '@raycast/api';
import { useCachedPromise } from '@raycast/utils';
import { getDashboardUrl, getServerOverviews, ServerOverview } from './devbox';

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

export default function Command() {
	const {
		data: servers = [],
		isLoading,
		revalidate,
	} = useCachedPromise(getServerOverviews, [], {
		failureToastOptions: { title: 'Could not load servers' },
	});
	const { data: dashboardUrl } = useCachedPromise(getDashboardUrl);

	return (
		<List isLoading={isLoading} isShowingDetail searchBarPlaceholder="Search servers">
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
									onAction={revalidate}
								/>
							</ActionPanel>
						}
					/>
				);
			})}
		</List>
	);
}
