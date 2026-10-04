import { Action, ActionPanel, Form, popToRoot } from '@raycast/api';
import { FormValidation, useForm } from '@raycast/utils';
import { LoginOptions, openLogin } from './frappectl';

function isSiteURL(value: string) {
	try {
		return ['http:', 'https:'].includes(new URL(value).protocol);
	} catch {
		return false;
	}
}

export default function Command() {
	const { handleSubmit, itemProps } = useForm<LoginOptions>({
		initialValues: { authMethod: 'oauth', readOnly: true, makeDefault: false },
		validation: {
			site: (value) => {
				if (!value?.trim()) {
					return FormValidation.Required;
				}
				if (!isSiteURL(value.trim())) {
					return 'Must start with http:// or https://';
				}
			},
		},
		async onSubmit(values) {
			const site = values.site.trim();
			const opened = await openLogin({
				...values,
				site,
				name: values.name.trim() || new URL(site).hostname,
				description: values.description.trim(),
			});
			if (opened) {
				await popToRoot();
			}
		},
	});

	return (
		<Form
			actions={
				<ActionPanel>
					<Action.SubmitForm title="Open Login in Terminal" onSubmit={handleSubmit} />
				</ActionPanel>
			}
		>
			<Form.TextField title="Site URL" placeholder="https://erp.example.com" {...itemProps.site} />
			<Form.TextField title="Profile Name" placeholder="Defaults to the site host" {...itemProps.name} />
			<Form.TextArea
				title="Description"
				placeholder="Used by assistant mode to pick a site"
				{...itemProps.description}
			/>
			<Form.Dropdown title="Auth Method" {...itemProps.authMethod}>
				<Form.Dropdown.Item value="oauth" title="OAuth (browser)" />
				<Form.Dropdown.Item value="api-key" title="API Key + Secret" />
			</Form.Dropdown>
			<Form.Checkbox label="Read-only (refuse writes)" {...itemProps.readOnly} />
			<Form.Checkbox label="Make default profile" {...itemProps.makeDefault} />
		</Form>
	);
}
