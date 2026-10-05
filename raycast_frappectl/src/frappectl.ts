import {
	Alert,
	confirmAlert,
	environment,
	getPreferenceValues,
	showHUD,
	showToast,
	Toast,
} from '@raycast/api';
import { runAppleScript, showFailureToast, useExec } from '@raycast/utils';
import { execFile } from 'node:child_process';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

// Raycast's PATH doesn't include ~/.local/bin, where uv installs frappectl.
export const FRAPPECTL_PATH = join(homedir(), '.local', 'bin', 'frappectl');

export type Profile = {
	profile: string;
	site: string;
	auth: string;
	description: string;
	read_only: boolean;
	default: boolean;
};

export type LoginOptions = {
	site: string;
	name: string;
	description: string;
	authMethod: string;
	readOnly: boolean;
	makeDefault: boolean;
};

export function useProfiles() {
	const { data, isLoading, revalidate } = useExec(FRAPPECTL_PATH, ['--json', 'auth', 'list'], {
		failureToastOptions: { title: 'Could not list frappectl profiles' },
	});
	const profiles: Profile[] = data ? JSON.parse(data) : [];
	return { profiles, isLoading, revalidate };
}

export function quoteShellArgument(value: string) {
	if (/^[\w@%+=:,./-]+$/.test(value)) {
		return value;
	}
	return `'${value.replaceAll("'", `'\\''`)}'`;
}

// Every prompt except the credentials is answered up front, so the terminal only asks for secrets.
export function buildLoginCommand(options: LoginOptions) {
	const loginArguments = [
		FRAPPECTL_PATH,
		'auth',
		'login',
		options.site,
		'--name',
		options.name,
		'--description',
		options.description,
		options.readOnly ? '--read-only' : '--writable',
	];
	if (options.makeDefault) {
		loginArguments.push('--default');
	}
	if (options.authMethod === 'oauth') {
		loginArguments.push('--oauth');
	} else {
		loginArguments.unshift('/usr/bin/expect', join(environment.assetsPath, 'login-with-api-key.exp'));
	}
	return loginArguments.map(quoteShellArgument).join(' ');
}

function escapeAppleScriptString(value: string) {
	return value.replaceAll('\\', '\\\\').replaceAll('"', '\\"');
}

async function runInTerminal(terminal: string, command: string) {
	const escapedCommand = escapeAppleScriptString(command);
	if (terminal === 'Terminal') {
		await runAppleScript(`
			tell application "Terminal"
				activate
				do script "${escapedCommand}"
			end tell
		`);
		return;
	}
	await runAppleScript(`
		tell application "iTerm"
			activate
			set loginWindow to (create window with default profile)
			tell current session of loginWindow to write text "${escapedCommand}"
		end tell
	`);
}

export async function openLogin(options: LoginOptions) {
	const { terminal } = getPreferenceValues<Preferences>();
	try {
		await runInTerminal(terminal, buildLoginCommand(options));
	} catch (error) {
		await showFailureToast(error, { title: `Could not open ${terminal}` });
		return false;
	}
	await showHUD(`Finish the login in ${terminal}`);
	return true;
}

// Logging in again under the same name overwrites the profile in place; frappectl verifies the
// new key before saving, and the default profile only changes when --default is passed.
export function refreshApiKeys(profile: Profile) {
	return openLogin({
		site: profile.site,
		name: profile.profile,
		description: profile.description,
		authMethod: 'api-key',
		readOnly: profile.read_only,
		makeDefault: false,
	});
}

// frappectl promotes the first remaining profile to default when the default one is removed.
export async function deleteProfile(profile: Profile, profiles: Profile[]) {
	const nextDefault = profiles.find((candidate) => candidate.profile !== profile.profile)?.profile;
	const confirmed = await confirmAlert({
		title: `Delete ${profile.profile}?`,
		message: [
			`Removes the profile and its stored credentials for ${profile.site}.`,
			profile.default && nextDefault ? `${nextDefault} becomes the default profile.` : '',
		].join(' '),
		primaryAction: { title: 'Delete', style: Alert.ActionStyle.Destructive },
	});
	if (!confirmed) {
		return false;
	}
	return runProfileCommand(['auth', 'logout', profile.profile], `Deleted ${profile.profile}`);
}

export async function setReadOnly(profile: Profile, readOnly: boolean) {
	if (!readOnly) {
		const confirmed = await confirmAlert({
			title: `Make ${profile.profile} writable?`,
			message: `Creates, updates, deletes and method calls through this profile will reach ${profile.site}.`,
			primaryAction: { title: 'Make Writable' },
		});
		if (!confirmed) {
			return false;
		}
	}
	return runProfileCommand(
		['auth', 'configure', profile.profile, readOnly ? '--read-only' : '--writable'],
		`${profile.profile} is now ${readOnly ? 'read-only' : 'writable'}`,
	);
}

async function runProfileCommand(commandArguments: string[], successTitle: string) {
	try {
		await promisify(execFile)(FRAPPECTL_PATH, commandArguments);
	} catch (error) {
		await showFailureToast(error, { title: 'frappectl failed' });
		return false;
	}
	await showToast({ style: Toast.Style.Success, title: successTitle });
	return true;
}
