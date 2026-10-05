import { environment, getPreferenceValues } from '@raycast/api';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { access, mkdir, readdir, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { extname, join } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.heic', '.tiff'];
const RECORDING_EXTENSIONS = ['.mov', '.mp4'];

export type Capture = {
	path: string;
	name: string;
	createdAt: Date;
	isRecording: boolean;
	thumbnail: string;
};

async function getCaptureFolder() {
	const { folder } = getPreferenceValues<Preferences>();
	if (folder) {
		return folder;
	}
	try {
		const { stdout } = await execFileAsync('/usr/bin/defaults', [
			'read',
			'com.apple.screencapture',
			'location',
		]);
		return stdout.trim().replace(/^~/, homedir());
	} catch {
		return join(homedir(), 'Desktop');
	}
}

// Raycast can't render video, so recordings get a QuickLook still, cached per file version.
async function getRecordingThumbnail(path: string, modifiedAt: number) {
	const cacheDirectory = join(environment.supportPath, 'thumbnails');
	const key = createHash('sha1').update(`${path}:${modifiedAt}`).digest('hex');
	const thumbnail = join(cacheDirectory, `${key}.png`);
	try {
		await access(thumbnail);
		return thumbnail;
	} catch {
		await mkdir(cacheDirectory, { recursive: true });
	}
	const workDirectory = join(cacheDirectory, key);
	await mkdir(workDirectory, { recursive: true });
	await execFileAsync('/usr/bin/qlmanage', ['-t', '-s', '640', '-o', workDirectory, path]);
	const [rendered] = await readdir(workDirectory);
	await execFileAsync('/bin/mv', [join(workDirectory, rendered), thumbnail]);
	await execFileAsync('/bin/rmdir', [workDirectory]);
	return thumbnail;
}

export async function getRecentCaptures(): Promise<Capture[]> {
	const { count } = getPreferenceValues<Preferences>();
	const limit = Math.max(1, Number.parseInt(count, 10) || 12);
	const folder = await getCaptureFolder();
	const names = await readdir(folder);
	const files = await Promise.all(
		names
			.filter((name) => [...IMAGE_EXTENSIONS, ...RECORDING_EXTENSIONS].includes(extname(name).toLowerCase()))
			.map(async (name) => {
				const path = join(folder, name);
				const details = await stat(path);
				return { path, name, details };
			}),
	);
	const recent = files
		.sort((first, second) => second.details.birthtimeMs - first.details.birthtimeMs)
		.slice(0, limit);
	return Promise.all(
		recent.map(async ({ path, name, details }) => {
			const isRecording = RECORDING_EXTENSIONS.includes(extname(name).toLowerCase());
			return {
				path,
				name,
				createdAt: details.birthtime,
				isRecording,
				thumbnail: isRecording ? await getRecordingThumbnail(path, details.mtimeMs).catch(() => path) : path,
			};
		}),
	);
}

// Raycast's Clipboard API holds one file; NSPasteboard takes several so Finder and chat apps paste them all.
export async function copyFiles(paths: string[]) {
	const script = `
		ObjC.import('AppKit');
		function run(paths) {
			const pasteboard = $.NSPasteboard.generalPasteboard;
			pasteboard.clearContents;
			const urls = $.NSMutableArray.alloc.init;
			paths.forEach((path) => urls.addObject($.NSURL.fileURLWithPath(path)));
			pasteboard.writeObjects(urls);
			// Exiting right after the write leaves only the first file on the pasteboard.
			delay(0.5);
		}
	`;
	await execFileAsync('/usr/bin/osascript', ['-l', 'JavaScript', '-e', script, ...paths]);
}

export function formatAge(date: Date) {
	const minutes = Math.round((Date.now() - date.getTime()) / 60000);
	if (minutes < 1) {
		return 'just now';
	}
	if (minutes < 60) {
		return `${minutes}m ago`;
	}
	const hours = Math.round(minutes / 60);
	if (hours < 24) {
		return `${hours}h ago`;
	}
	return `${Math.round(hours / 24)}d ago`;
}

const TERMINAL_BUNDLE_IDS = [
	'com.googlecode.iterm2',
	'com.apple.Terminal',
	'com.mitchellh.ghostty',
	'dev.warp.Warp-Stable',
	'net.kovidgoyal.kitty',
	'io.alacritty',
	'com.github.wez.wezterm',
];

export function isTerminal(bundleId?: string) {
	return Boolean(bundleId && TERMINAL_BUNDLE_IDS.includes(bundleId));
}

// Same text a terminal inserts when files are dropped on it: quoted paths, then a space.
export function formatPathsForShell(paths: string[]) {
	return `${paths.map((path) => `'${path.replaceAll("'", `'\\''`)}'`).join(' ')} `;
}
