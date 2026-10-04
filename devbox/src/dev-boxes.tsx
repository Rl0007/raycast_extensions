import {
	Action,
	ActionPanel,
	Alert,
	Color,
	confirmAlert,
	Form,
	Icon,
	Keyboard,
	List,
	showHUD,
	showToast,
	Toast,
	useNavigation,
} from '@raycast/api';
import { showFailureToast, useCachedPromise, useForm } from '@raycast/utils';
import { callDevBoxMethod, DevBox, DEVBOXCTL_PATH, getDevBoxes, runCommand, runInTerminal } from './devbox';

const STATUS_COLORS: Record<string, Color> = {
	active: Color.Green,
	stopped: Color.SecondaryText,
	error: Color.Red,
};

const BOX_ACTIONS = {
	start_box: { verb: 'Start', allowedStatuses: ['stopped'] },
	stop_box: { verb: 'Stop', allowedStatuses: ['active', 'creating', 'starting'] },
	delete_box: { verb: 'Delete', allowedStatuses: ['active', 'stopped', 'error'] },
} as const;

type BoxMethod = keyof typeof BOX_ACTIONS;

export default function Command() {
	const {
		data: devBoxes = [],
		isLoading,
		revalidate,
	} = useCachedPromise(getDevBoxes, [], {
		failureToastOptions: { title: 'Could not load dev boxes' },
	});

	async function runBoxMethod(devBox: DevBox, method: BoxMethod) {
		const { verb } = BOX_ACTIONS[method];
		const confirmed = await confirmAlert({
			title: `${verb} ${devBox.nickname ?? devBox.name}?`,
			message: method === 'delete_box' ? 'The box and everything on it is gone for good.' : undefined,
			primaryAction: {
				title: verb,
				style: method === 'delete_box' ? Alert.ActionStyle.Destructive : Alert.ActionStyle.Default,
			},
		});
		if (!confirmed) {
			return;
		}
		const toast = await showToast({ style: Toast.Style.Animated, title: `${verb} requested…` });
		try {
			await callDevBoxMethod(method, devBox.name);
			toast.style = Toast.Style.Success;
			toast.title = `${verb} sent to ${devBox.nickname ?? devBox.name}`;
			revalidate();
		} catch (error) {
			await showFailureToast(error, { title: `Could not ${verb.toLowerCase()} ${devBox.name}` });
		}
	}

	async function attach(devBox: DevBox) {
		try {
			const terminal = await runInTerminal([DEVBOXCTL_PATH, 'attach', devBox.name]);
			await showHUD(`Attaching in ${terminal}`);
		} catch (error) {
			await showFailureToast(error, { title: 'Could not open the terminal' });
		}
	}

	return (
		<List isLoading={isLoading} searchBarPlaceholder="Search dev boxes">
			<List.EmptyView title="No dev boxes" description="Provision one with the Provision Dev Box command" />
			{devBoxes.map((devBox) => (
				<List.Item
					key={devBox.name}
					icon={Icon.ComputerChip}
					title={devBox.nickname ?? devBox.name}
					subtitle={devBox.title ?? undefined}
					keywords={[devBox.name, devBox.devbox_template ?? '']}
					accessories={[
						{ text: devBox.memory_usage ?? undefined, tooltip: 'Memory' },
						{ text: devBox.devbox_template ?? undefined },
						{ tag: { value: devBox.status, color: STATUS_COLORS[devBox.status] ?? Color.Yellow } },
					]}
					actions={
						<ActionPanel>
							<ActionPanel.Section>
								<Action title="Attach" icon={Icon.Terminal} onAction={() => attach(devBox)} />
								{devBox.site_url && <Action.OpenInBrowser title="Open Site" url={devBox.site_url} />}
								{devBox.code_url && (
									<Action.OpenInBrowser
										title="Open Code"
										url={devBox.code_url}
										shortcut={Keyboard.Shortcut.Common.Edit}
									/>
								)}
								{devBox.term_url && (
									<Action.OpenInBrowser
										title="Open Web Terminal"
										url={devBox.term_url}
										shortcut={{ modifiers: ['cmd'], key: 't' }}
									/>
								)}
							</ActionPanel.Section>
							<ActionPanel.Section>
								<Action.CopyToClipboard
									title="Copy Attach Command"
									content={`devboxctl attach ${devBox.nickname ?? devBox.name}`}
								/>
								<Action.CopyToClipboard
									title="Copy Slug"
									content={devBox.name}
									shortcut={Keyboard.Shortcut.Common.Copy}
								/>
								{devBox.site_url && (
									<Action.CopyToClipboard
										title="Copy Site URL"
										content={devBox.site_url}
										shortcut={Keyboard.Shortcut.Common.CopyDeeplink}
									/>
								)}
								<Action.Push
									title="Set Nickname"
									icon={Icon.Pencil}
									target={<NicknameForm devBox={devBox} onSaved={revalidate} />}
								/>
							</ActionPanel.Section>
							<ActionPanel.Section>
								{(Object.keys(BOX_ACTIONS) as BoxMethod[])
									.filter((method) =>
										BOX_ACTIONS[method].allowedStatuses.some((status) => status === devBox.status),
									)
									.map((method) => (
										<Action
											key={method}
											title={BOX_ACTIONS[method].verb}
											icon={
												method === 'start_box' ? Icon.Play : method === 'stop_box' ? Icon.Stop : Icon.Trash
											}
											style={method === 'delete_box' ? Action.Style.Destructive : Action.Style.Regular}
											onAction={() => runBoxMethod(devBox, method)}
										/>
									))}
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
			))}
		</List>
	);
}

function NicknameForm({ devBox, onSaved }: { devBox: DevBox; onSaved: () => void }) {
	const { pop } = useNavigation();
	const { handleSubmit, itemProps } = useForm<{ nickname: string }>({
		initialValues: { nickname: devBox.nickname ?? '' },
		validation: {
			nickname: (value) => {
				if (!value?.trim()) {
					return 'Required';
				}
				if (/[\s=]/.test(value.trim())) {
					return 'No spaces or "="';
				}
			},
		},
		async onSubmit({ nickname }) {
			try {
				await runCommand(DEVBOXCTL_PATH, ['name', devBox.name, nickname.trim()]);
			} catch (error) {
				await showFailureToast(error, { title: 'Could not save the nickname' });
				return;
			}
			await showToast({ title: `Named ${devBox.name} ${nickname.trim()}` });
			onSaved();
			pop();
		},
	});

	return (
		<Form
			navigationTitle={`Nickname for ${devBox.name}`}
			actions={
				<ActionPanel>
					<Action.SubmitForm title="Save Nickname" onSubmit={handleSubmit} />
				</ActionPanel>
			}
		>
			<Form.TextField title="Nickname" placeholder="my-box" {...itemProps.nickname} />
		</Form>
	);
}
