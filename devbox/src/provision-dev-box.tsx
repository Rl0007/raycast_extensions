import { Action, ActionPanel, Form, popToRoot, showHUD } from '@raycast/api';
import { FormValidation, showFailureToast, useCachedPromise, useForm } from '@raycast/utils';
import { DEVBOXCTL_PATH, getDevBoxes, getProvisionProfiles, runInTerminal } from './devbox';

type ProvisionValues = {
	profile: string;
	branch: string;
	slug: string;
};

export default function Command() {
	const { data: profiles = [], isLoading: isLoadingProfiles } = useCachedPromise(getProvisionProfiles);
	const { data: devBoxes = [], isLoading: isLoadingBoxes } = useCachedPromise(getDevBoxes, [], {
		failureToastOptions: { title: 'Could not load dev boxes' },
	});
	const { handleSubmit, itemProps } = useForm<ProvisionValues>({
		initialValues: { slug: '' },
		validation: { profile: FormValidation.Required },
		async onSubmit(values) {
			const commandArguments = [DEVBOXCTL_PATH, 'provision', values.profile];
			if (values.branch.trim()) {
				commandArguments.push('--branch', values.branch.trim());
			}
			if (values.slug) {
				commandArguments.push('--slug', values.slug);
			}
			try {
				const terminal = await runInTerminal(commandArguments);
				await showHUD(`Provisioning in ${terminal}`);
				await popToRoot();
			} catch (error) {
				await showFailureToast(error, { title: 'Could not open the terminal' });
			}
		},
	});

	return (
		<Form
			isLoading={isLoadingProfiles || isLoadingBoxes}
			actions={
				<ActionPanel>
					<Action.SubmitForm title="Provision in Terminal" onSubmit={handleSubmit} />
				</ActionPanel>
			}
		>
			<Form.Dropdown title="Profile" {...itemProps.profile}>
				{profiles.map((profile) => (
					<Form.Dropdown.Item key={profile} value={profile} title={profile} />
				))}
			</Form.Dropdown>
			<Form.TextField
				title="Branch"
				placeholder="Defaults to the current branch of the local checkout"
				{...itemProps.branch}
			/>
			<Form.Dropdown
				title="Box"
				info="Reuse an existing box instead of creating a new one"
				{...itemProps.slug}
			>
				<Form.Dropdown.Item value="" title="New box" />
				{devBoxes.map((devBox) => (
					<Form.Dropdown.Item
						key={devBox.name}
						value={devBox.name}
						title={`${devBox.nickname ?? devBox.name} — ${devBox.title ?? devBox.status}`}
					/>
				))}
			</Form.Dropdown>
		</Form>
	);
}
