import { execFile } from "node:child_process";
import { readdir, readFile, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const helperDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(helperDir, "../../..");
const launcherDir = path.join(repoRoot, "python-apps", "launcher");

const defaultHeadlessLog = path.join(os.homedir(), ".local", "share", "librocco-launcher", "logs", "headless.log");

const sleep = (ms: number) =>
	new Promise<void>((resolve) => {
		setTimeout(resolve, ms);
	});

type CircusDaemon = "syncserver" | "caddy";
type CircusCommand = "start" | "stop" | "status" | "restart";

type CircusResponse = {
	status?: string;
	[key: string]: unknown;
};

async function sendCircusDaemonCommandWithEndpoint(
	endpoint: string,
	command: CircusCommand,
	daemon: CircusDaemon
): Promise<CircusResponse> {
	const script = [
		"import json",
		"import sys",
		"from circus.client import CircusClient",
		"endpoint = sys.argv[1]",
		"command = sys.argv[2]",
		"name = sys.argv[3]",
		"client = CircusClient(endpoint=endpoint)",
		"response = client.send_message(command, name=name)",
		"print(json.dumps(response))"
	].join("\n");

	const { stdout } = await execFileAsync("uv", ["run", "--directory", launcherDir, "python", "-c", script, endpoint, command, daemon], {
		cwd: repoRoot
	});

	const payload = stdout.trim();
	if (!payload) {
		throw new Error(`Circus command "${command}" returned no output`);
	}

	return JSON.parse(payload) as CircusResponse;
}

async function resolveEndpointFromHeadlessLog() {
	try {
		const headlessLogPath = process.env.LIBROCCO_HEADLESS_LOG_PATH || defaultHeadlessLog;
		const log = await readFile(headlessLogPath, "utf8");
		const matches = [...log.matchAll(/Using IPC endpoint for Circus:\s*(\S+)/g)];
		const endpoint = matches.at(-1)?.[1]?.trim();
		return endpoint || null;
	} catch {
		return null;
	}
}

async function resolveEndpointFromLauncherPidFile() {
	try {
		const uvPidRaw = (await readFile("/tmp/launcher.pid", "utf8")).trim();
		if (!uvPidRaw) return null;
		const uvPid = Number.parseInt(uvPidRaw, 10);
		if (!Number.isFinite(uvPid)) return null;

		const { stdout } = await execFileAsync("pgrep", ["-P", String(uvPid), "-f", "main_headless.py"]);
		const launcherPid = stdout
			.split("\n")
			.map((x) => x.trim())
			.find(Boolean);
		if (!launcherPid) return null;
		return `ipc:///tmp/librocco-circus-${launcherPid}.sock`;
	} catch {
		return null;
	}
}

async function resolveEndpointFromTmpSockets() {
	try {
		const entries = await readdir("/tmp");
		const candidates = entries.filter((entry) => /^librocco-circus-\d+\.sock$/.test(entry));
		if (candidates.length === 0) return [] as string[];

		const withMtime = await Promise.all(
			candidates.map(async (entry) => ({
				entry,
				mtimeMs: (await stat(path.join("/tmp", entry))).mtimeMs
			}))
		);
		return withMtime.sort((a, b) => b.mtimeMs - a.mtimeMs).map(({ entry }) => `ipc:///tmp/${entry}`);
	} catch {
		return [] as string[];
	}
}

async function canUseEndpoint(endpoint: string) {
	try {
		const status = await sendCircusDaemonCommandWithEndpoint(endpoint, "status", "syncserver");
		return typeof status.status === "string";
	} catch {
		return false;
	}
}

async function resolveCircusEndpoint(): Promise<string | null> {
	const candidates = [
		process.env.LIBROCCO_CIRCUS_ENDPOINT?.trim() || null,
		await resolveEndpointFromHeadlessLog(),
		await resolveEndpointFromLauncherPidFile(),
		...(await resolveEndpointFromTmpSockets())
	];

	const visited = new Set<string>();
	for (const endpoint of candidates) {
		if (!endpoint || visited.has(endpoint)) continue;
		visited.add(endpoint);

		if (await canUseEndpoint(endpoint)) {
			return endpoint;
		}
	}

	return null;
}

async function sendCircusDaemonCommand(command: CircusCommand, daemon: CircusDaemon): Promise<CircusResponse> {
	const endpoint = await resolveCircusEndpoint();
	if (!endpoint) {
		throw new Error("Circus endpoint not found. Ensure launcher is running and expose LIBROCCO_CIRCUS_ENDPOINT when needed.");
	}
	return sendCircusDaemonCommandWithEndpoint(endpoint, command, daemon);
}

export async function isSyncServerCircusControlAvailable() {
	try {
		return Boolean(await resolveCircusEndpoint());
	} catch {
		return false;
	}
}

export async function getSyncServerCircusStatus() {
	const response = await sendCircusDaemonCommand("status", "syncserver");
	return String(response.status || "");
}

export async function stopSyncServerViaCircus() {
	await sendCircusDaemonCommand("stop", "syncserver");
}

export async function startSyncServerViaCircus() {
	await sendCircusDaemonCommand("start", "syncserver");
}

export async function waitForSyncServerCircusStatus(target: "active" | "stopped", opts: { timeoutMs?: number; intervalMs?: number } = {}) {
	const timeoutMs = opts.timeoutMs ?? 20_000;
	const intervalMs = opts.intervalMs ?? 250;
	const deadline = Date.now() + timeoutMs;

	while (Date.now() < deadline) {
		try {
			const status = await getSyncServerCircusStatus();
			if (status === target) {
				return;
			}
		} catch {
			// Retry while service transitions
		}
		await sleep(intervalMs);
	}

	throw new Error(`Timed out waiting for syncserver status "${target}"`);
}
