import { getPreferenceValues } from '@raycast/api';
import { runAppleScript } from '@raycast/utils';
import { execFile } from 'node:child_process';
import { readdir, readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

// Raycast's PATH doesn't include ~/.local/bin or ~/bin.
export const FRAPPECTL_PATH = join(homedir(), '.local', 'bin', 'frappectl');
export const DEVBOXCTL_PATH = join(homedir(), 'bin', 'devboxctl');
const DEVBOX_PROFILE = 'devbox';
const PROFILE_DIRECTORY = join(homedir(), '.config', 'devbox', 'profiles');
const NICKNAME_FILE = join(homedir(), '.config', 'devbox', 'nicknames.conf');

export type DevBox = {
	name: string;
	title: string | null;
	status: string;
	devbox_template: string | null;
	site_url: string | null;
	code_url: string | null;
	term_url: string | null;
	memory_usage: string | null;
	disk_usage: string | null;
	nickname?: string;
};

export async function runCommand(file: string, commandArguments: string[]) {
	try {
		const { stdout } = await execFileAsync(file, commandArguments);
		return stdout;
	} catch (error) {
		// frappectl prints an authlib deprecation warning on every run; surface its "error:" line instead.
		const stderr = (error as { stderr?: string }).stderr ?? '';
		const message = stderr.split('\n').find((line) => line.startsWith('error:'));
		throw new Error(message ?? (error as Error).message);
	}
}

async function runFrappectl(commandArguments: string[]) {
	return JSON.parse(await runCommand(FRAPPECTL_PATH, ['-s', DEVBOX_PROFILE, ...commandArguments]));
}

export async function readNicknames() {
	const nicknames = new Map<string, string>();
	const contents = await readFile(NICKNAME_FILE, 'utf8').catch(() => '');
	for (const line of contents.split('\n')) {
		const [slug, ...nickname] = line.split('=');
		if (slug && nickname.length) {
			nicknames.set(slug, nickname.join('='));
		}
	}
	return nicknames;
}

// Same filters as `devboxctl list`, which only prints a human-readable table.
export async function getDevBoxes(): Promise<DevBox[]> {
	const [user, nicknames] = await Promise.all([
		runFrappectl(['method', 'call', 'frappe.auth.get_logged_user']),
		readNicknames(),
	]);
	const devBoxes: DevBox[] = await runFrappectl([
		'doc',
		'list',
		'Dev Box',
		'-f',
		`owner_user=${user}`,
		'-f',
		'status!=deleted',
		'--fields',
		'name,title,status,devbox_template,site_url,code_url,term_url,memory_usage,disk_usage',
		'--all',
	]);
	return devBoxes.map((devBox) => ({ ...devBox, nickname: nicknames.get(devBox.name) }));
}

export async function callDevBoxMethod(method: 'start_box' | 'stop_box' | 'delete_box', slug: string) {
	await runCommand(FRAPPECTL_PATH, [
		'-s',
		DEVBOX_PROFILE,
		'method',
		'call',
		method,
		'--doctype',
		'Dev Box',
		'--name',
		slug,
	]);
}

export async function getProvisionProfiles() {
	const files = await readdir(PROFILE_DIRECTORY).catch(() => []);
	return files.filter((file) => file.endsWith('.conf')).map((file) => file.replace(/\.conf$/, ''));
}

export function quoteShellArgument(value: string) {
	if (/^[\w@%+=:,./-]+$/.test(value)) {
		return value;
	}
	return `'${value.replaceAll("'", `'\\''`)}'`;
}

function escapeAppleScriptString(value: string) {
	return value.replaceAll('\\', '\\\\').replaceAll('"', '\\"');
}

export async function runInTerminal(commandArguments: string[]) {
	const { terminal } = getPreferenceValues<Preferences>();
	const escapedCommand = escapeAppleScriptString(commandArguments.map(quoteShellArgument).join(' '));
	if (terminal === 'Terminal') {
		await runAppleScript(`
			tell application "Terminal"
				activate
				do script "${escapedCommand}"
			end tell
		`);
		return terminal;
	}
	await runAppleScript(`
		tell application "iTerm"
			activate
			set commandWindow to (create window with default profile)
			tell current session of commandWindow to write text "${escapedCommand}"
		end tell
	`);
	return terminal;
}
