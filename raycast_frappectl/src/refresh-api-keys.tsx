import { Action, ActionPanel, Color, Icon, List, popToRoot } from '@raycast/api';
import { refreshApiKeys, useProfiles } from './frappectl';

export default function Command() {
	const { profiles, isLoading } = useProfiles();

	return (
		<List isLoading={isLoading} searchBarPlaceholder="Pick the profile to refresh">
			{profiles
				.filter((profile) => profile.auth === 'api_key')
				.map((profile) => (
					<List.Item
						key={profile.profile}
						title={profile.profile}
						subtitle={profile.site}
						icon={profile.default ? { source: Icon.Star, tintColor: Color.Yellow } : Icon.Key}
						keywords={[profile.site, profile.description]}
						accessories={[{ tag: profile.read_only ? 'read-only' : 'writable' }]}
						actions={
							<ActionPanel>
								<Action
									title="Refresh API Keys"
									icon={Icon.Key}
									onAction={async () => {
										if (await refreshApiKeys(profile)) {
											await popToRoot();
										}
									}}
								/>
							</ActionPanel>
						}
					/>
				))}
		</List>
	);
}
