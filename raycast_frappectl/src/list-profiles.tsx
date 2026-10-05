import { Action, ActionPanel, Color, Icon, Keyboard, List } from '@raycast/api';
import { deleteProfile, refreshApiKeys, setReadOnly, useProfiles } from './frappectl';

export default function Command() {
	const { profiles, isLoading, revalidate } = useProfiles();

	return (
		<List isLoading={isLoading} isShowingDetail searchBarPlaceholder="Search profiles">
			{profiles.map((profile) => (
				<List.Item
					key={profile.profile}
					title={profile.profile}
					icon={profile.default ? { source: Icon.Star, tintColor: Color.Yellow } : Icon.Globe}
					keywords={[profile.site, profile.description]}
					detail={
						<List.Item.Detail
							metadata={
								<List.Item.Detail.Metadata>
									<List.Item.Detail.Metadata.Link title="Site" target={profile.site} text={profile.site} />
									<List.Item.Detail.Metadata.Label title="Description" text={profile.description || '—'} />
									<List.Item.Detail.Metadata.Separator />
									<List.Item.Detail.Metadata.TagList title="Flags">
										<List.Item.Detail.Metadata.TagList.Item text={profile.auth} />
										{profile.default && (
											<List.Item.Detail.Metadata.TagList.Item text="default" color={Color.Yellow} />
										)}
										{profile.read_only ? (
											<List.Item.Detail.Metadata.TagList.Item text="read-only" color={Color.Blue} />
										) : (
											<List.Item.Detail.Metadata.TagList.Item text="writable" color={Color.Orange} />
										)}
									</List.Item.Detail.Metadata.TagList>
								</List.Item.Detail.Metadata>
							}
						/>
					}
					actions={
						<ActionPanel>
							<Action.OpenInBrowser title="Open Site" url={profile.site} />
							<Action.CopyToClipboard title="Copy Profile Name" content={profile.profile} />
							<Action.CopyToClipboard
								title="Copy Site URL"
								content={profile.site}
								shortcut={Keyboard.Shortcut.Common.Copy}
							/>
							{profile.auth === 'api_key' && (
								<Action
									title="Refresh API Keys"
									icon={Icon.Key}
									shortcut={{ modifiers: ['cmd', 'shift'], key: 'k' }}
									onAction={() => refreshApiKeys(profile)}
								/>
							)}
							<Action
								title={profile.read_only ? 'Make Writable' : 'Make Read-Only'}
								icon={profile.read_only ? Icon.LockUnlocked : Icon.Lock}
								onAction={async () => {
									if (await setReadOnly(profile, !profile.read_only)) {
										revalidate();
									}
								}}
							/>
							<Action
								title="Delete Profile"
								icon={Icon.Trash}
								style={Action.Style.Destructive}
								shortcut={Keyboard.Shortcut.Common.Remove}
								onAction={async () => {
									if (await deleteProfile(profile, profiles)) {
										revalidate();
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
