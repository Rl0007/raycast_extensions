import {
	Action,
	ActionPanel,
	Color,
	getFrontmostApplication,
	Grid,
	Icon,
	Keyboard,
	showHUD,
} from '@raycast/api';
import { showFailureToast, useCachedPromise, usePromise } from '@raycast/utils';
import { useState } from 'react';
import {
	Capture,
	copyFiles,
	formatAge,
	formatPathsForShell,
	getRecentCaptures,
	isTerminal,
} from './screenshots';

export default function Command() {
	const {
		data: captures = [],
		isLoading,
		revalidate,
	} = useCachedPromise(getRecentCaptures, [], {
		failureToastOptions: { title: 'Could not read the screenshot folder' },
	});
	const { data: frontmostApplication } = usePromise(getFrontmostApplication);
	const [selectedPaths, setSelectedPaths] = useState<string[]>([]);
	const selectedCaptures = captures.filter((capture) => selectedPaths.includes(capture.path));
	const inTerminal = isTerminal(frontmostApplication?.bundleId);

	function toggleSelection(capture: Capture) {
		setSelectedPaths((paths) =>
			paths.includes(capture.path) ? paths.filter((path) => path !== capture.path) : [...paths, capture.path],
		);
	}

	async function copySelection() {
		try {
			await copyFiles(selectedCaptures.map((capture) => capture.path));
		} catch (error) {
			await showFailureToast(error, { title: 'Could not copy the screenshots' });
			return;
		}
		await showHUD(`Copied ${selectedCaptures.length} to the clipboard`);
	}

	return (
		<Grid
			columns={4}
			aspectRatio="16/9"
			fit={Grid.Fit.Fill}
			isLoading={isLoading}
			searchBarPlaceholder="Search recent screenshots"
			navigationTitle={selectedPaths.length ? `${selectedPaths.length} selected` : undefined}
		>
			<Grid.EmptyView icon={Icon.Image} title="No screenshots yet" />
			{captures.map((capture) => {
				const isSelected = selectedPaths.includes(capture.path);
				const pathTargets = selectedCaptures.length
					? selectedCaptures.map((selected) => selected.path)
					: [capture.path];
				const pathLabel = pathTargets.length > 1 ? `${pathTargets.length} Paths` : 'Path';
				const pastePathAction = (
					<Action.Paste
						title={`Paste ${pathLabel}`}
						icon={Icon.Terminal}
						content={formatPathsForShell(pathTargets)}
					/>
				);
				const copyPathAction = (
					<Action.CopyToClipboard
						title={`Copy ${pathLabel}`}
						content={formatPathsForShell(pathTargets).trimEnd()}
						shortcut={Keyboard.Shortcut.Common.CopyPath}
					/>
				);
				return (
					<Grid.Item
						key={capture.path}
						content={capture.thumbnail}
						title={`${capture.isRecording ? 'Recording · ' : ''}${formatAge(capture.createdAt)}`}
						keywords={[capture.name]}
						accessory={
							isSelected
								? { icon: { source: Icon.CheckCircle, tintColor: Color.Green }, tooltip: 'Selected' }
								: undefined
						}
						actions={
							<ActionPanel>
								{inTerminal ? (
									<ActionPanel.Section>
										{pastePathAction}
										<Action.CopyToClipboard title="Copy to Clipboard" content={{ file: capture.path }} />
										{copyPathAction}
									</ActionPanel.Section>
								) : (
									<ActionPanel.Section>
										<Action.CopyToClipboard title="Copy to Clipboard" content={{ file: capture.path }} />
										<Action.Paste title="Paste" content={{ file: capture.path }} />
										{pastePathAction}
										{copyPathAction}
									</ActionPanel.Section>
								)}
								<ActionPanel.Section>
									<Action
										title={isSelected ? 'Deselect' : 'Select'}
										icon={isSelected ? Icon.Circle : Icon.CheckCircle}
										onAction={() => toggleSelection(capture)}
									/>
									{selectedCaptures.length > 0 && (
										<Action
											title={`Copy ${selectedCaptures.length} Selected`}
											icon={Icon.CopyClipboard}
											shortcut={Keyboard.Shortcut.Common.Copy}
											onAction={copySelection}
										/>
									)}
									{selectedCaptures.length > 0 && (
										<Action
											title="Clear Selection"
											icon={Icon.XMarkCircle}
											onAction={() => setSelectedPaths([])}
										/>
									)}
								</ActionPanel.Section>
								<ActionPanel.Section>
									<Action.Open title="Open" target={capture.path} shortcut={Keyboard.Shortcut.Common.Open} />
									<Action.ShowInFinder path={capture.path} />
									<Action.Trash
										paths={capture.path}
										shortcut={Keyboard.Shortcut.Common.Remove}
										onTrash={() => {
											setSelectedPaths((paths) => paths.filter((path) => path !== capture.path));
											revalidate();
										}}
									/>
									<Action
										title="Refresh"
										icon={Icon.ArrowClockwise}
										shortcut={Keyboard.Shortcut.Common.Refresh}
										onAction={revalidate}
									/>
								</ActionPanel.Section>
							</ActionPanel>
						}
					/>
				);
			})}
		</Grid>
	);
}
