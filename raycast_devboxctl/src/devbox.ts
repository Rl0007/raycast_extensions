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

export type DiskUsage = { mount: string; size: number; used: number };

export type ServerStats = {
	cores: number;
	load: string[];
	memoryTotal: number;
	memoryAvailable: number;
	disks: DiskUsage[];
	uptimeSeconds: number;
};

export type ServerOverview = {
	name: string;
	ip_address: string | null;
	domain: string | null;
	status: string;
	sshTarget: string | null;
	devBoxes: { total: number; active: number };
	stats?: ServerStats;
	error?: string;
};

const STATS_COMMAND = [
	'echo "cores $(nproc)"',
	'echo "load $(cut -d" " -f1-3 /proc/loadavg)"',
	'free -b | awk \'/^Mem:/ {print "memory", $2, $7}\'',
	'df -B1 -x tmpfs -x devtmpfs -x overlay -x squashfs -x efivarfs --output=target,size,used | tail -n +2 | sed "s/^/disk /"',
	'echo "uptime $(cut -d" " -f1 /proc/uptime)"',
].join('; ');

// ~/.ssh/config decides which key reaches a server, so reuse the alias whose HostName is its IP.
async function findSshTarget(ipAddress: string) {
	const config = await readFile(join(homedir(), '.ssh', 'config'), 'utf8').catch(() => '');
	let aliases: string[] = [];
	for (const line of config.split('\n')) {
		const [keyword, ...values] = line.trim().split(/\s+/);
		if (keyword?.toLowerCase() === 'host') {
			aliases = values.filter((alias) => !/[*?]/.test(alias));
		} else if (keyword?.toLowerCase() === 'hostname' && values[0] === ipAddress && aliases.length) {
			return aliases[0];
		}
	}
	return `root@${ipAddress}`;
}

function parseServerStats(output: string): ServerStats {
	const stats: ServerStats = {
		cores: 0,
		load: [],
		memoryTotal: 0,
		memoryAvailable: 0,
		disks: [],
		uptimeSeconds: 0,
	};
	for (const line of output.split('\n')) {
		const [key, ...values] = line.trim().split(/\s+/);
		if (key === 'cores') {
			stats.cores = Number(values[0]);
		} else if (key === 'load') {
			stats.load = values;
		} else if (key === 'memory') {
			stats.memoryTotal = Number(values[0]);
			stats.memoryAvailable = Number(values[1]);
		} else if (key === 'disk') {
			stats.disks.push({ mount: values[0], size: Number(values[1]), used: Number(values[2]) });
		} else if (key === 'uptime') {
			stats.uptimeSeconds = Number(values[0]);
		}
	}
	return stats;
}

async function getServerStats(sshTarget: string) {
	const { stdout } = await execFileAsync(
		'/usr/bin/ssh',
		['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=5', sshTarget, STATS_COMMAND],
		{ timeout: 15000 },
	);
	return parseServerStats(stdout);
}

export async function getServerOverviews(): Promise<ServerOverview[]> {
	const [servers, devBoxes]: [
		{ name: string; ip_address: string | null; domain: string | null; status: string }[],
		{ status: string; server: string | null }[],
	] = await Promise.all([
		runFrappectl(['doc', 'list', 'Server', '--fields', 'name,ip_address,domain,status', '--all']),
		runFrappectl(['doc', 'list', 'Dev Box', '-f', 'status!=deleted', '--fields', 'status,server', '--all']),
	]);
	return Promise.all(
		servers.map(async (server) => {
			const boxes = devBoxes.filter((devBox) => devBox.server === server.name);
			const overview: ServerOverview = {
				...server,
				sshTarget: null,
				devBoxes: {
					total: boxes.length,
					active: boxes.filter((devBox) => devBox.status === 'active').length,
				},
			};
			if (!server.ip_address) {
				return { ...overview, error: 'No IP address on the Server record' };
			}
			overview.sshTarget = await findSshTarget(server.ip_address);
			try {
				return { ...overview, stats: await getServerStats(overview.sshTarget) };
			} catch (error) {
				const stderr = (error as { stderr?: string }).stderr?.trim();
				return { ...overview, error: stderr || (error as Error).message };
			}
		}),
	);
}

export async function getDashboardUrl() {
	const { stdout } = await execFileAsync(FRAPPECTL_PATH, ['--json', 'auth', 'list']);
	const profiles: { profile: string; site: string }[] = JSON.parse(stdout);
	return profiles.find((profile) => profile.profile === DEVBOX_PROFILE)?.site;
}
