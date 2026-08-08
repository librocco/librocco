/**
 * Tests for the client-version gate (Linear D-609).
 *
 * Unit tests cover the deny-list parsing and gate decisions; the integration
 * test drives a real HTTP upgrade against `attachWebsocketServer` with the
 * gate passed as the (positional) `authenticate` argument, proving a denied
 * client is refused with 401 before the sync protocol starts and an allowed
 * client completes the websocket upgrade (101).
 */

import { test, expect, describe, afterEach, vi } from "vitest";
import * as http from "http";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import { attachWebsocketServer, type Config } from "@vlcn.io/ws-server";

import { UNVERSIONED, extractClientVersion, makeVersionGate, parseDeniedClientVersions } from "./version-gate.js";

describe("parseDeniedClientVersions", () => {
	test("splits, trims and drops empty entries", () => {
		expect(parseDeniedClientVersions("abc123, def456 ,,")).toEqual(new Set(["abc123", "def456"]));
		expect(parseDeniedClientVersions(undefined)).toEqual(new Set());
		expect(parseDeniedClientVersions("")).toEqual(new Set());
		expect(parseDeniedClientVersions(" unversioned ")).toEqual(new Set([UNVERSIONED]));
	});
});

describe("extractClientVersion", () => {
	test("reads the client_version query parameter", () => {
		expect(extractClientVersion("/sync?client_version=abc123")).toBe("abc123");
		expect(extractClientVersion("/sync?foo=bar&client_version=abc123")).toBe("abc123");
	});

	test("returns null when absent, empty or unparseable", () => {
		expect(extractClientVersion("/sync")).toBe(null);
		expect(extractClientVersion("/sync?client_version=")).toBe(null);
		expect(extractClientVersion(undefined)).toBe(null);
		expect(extractClientVersion("http://%")).toBe(null);
	});
});

describe("makeVersionGate", () => {
	const run = (denied: Set<string>, url: string | undefined): Promise<Error | null> =>
		new Promise((resolve) => {
			const req = { url, headers: {} } as http.IncomingMessage;
			makeVersionGate(denied)(req, null, (err) => resolve(err ?? null));
		});

	test("allows any version when the deny list is empty", async () => {
		expect(await run(new Set(), "/sync?client_version=abc123")).toBe(null);
		expect(await run(new Set(), "/sync")).toBe(null);
	});

	test("denies a listed version, allows others", async () => {
		const denied = new Set(["bad001"]);
		expect(await run(denied, "/sync?client_version=bad001")).toBeInstanceOf(Error);
		expect(await run(denied, "/sync?client_version=good02")).toBe(null);
		// A client sending no version is NOT covered by a concrete-version entry
		expect(await run(denied, "/sync")).toBe(null);
	});

	test("the 'unversioned' token denies clients that announce no version", async () => {
		const denied = new Set([UNVERSIONED]);
		expect(await run(denied, "/sync")).toBeInstanceOf(Error);
		expect(await run(denied, "/sync?client_version=abc123")).toBe(null);
	});

	test("rate-limits repeated deny logs for the same version+room (denies every attempt regardless)", async () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		try {
			const gate = makeVersionGate(new Set(["bad001"]));
			const req = { url: "/sync?client_version=bad001", headers: {} } as http.IncomingMessage;
			const errors: unknown[] = [];
			// A denied client retries every 1-3s; each attempt must be denied, but only the first logged
			for (let i = 0; i < 5; i++) gate(req, null, (err) => errors.push(err));
			expect(errors.filter((e) => e instanceof Error)).toHaveLength(5);
			expect(warn).toHaveBeenCalledTimes(1);
		} finally {
			warn.mockRestore();
		}
	});
});

describe("integration: attachWebsocketServer with the gate", () => {
	let server: http.Server | null = null;
	let tmpDir: string | null = null;

	afterEach(async () => {
		const srv = server;
		if (srv) await new Promise((resolve) => srv.close(resolve));
		server = null;
		if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
		tmpDir = null;
	});

	/** Issues a raw websocket upgrade request; resolves "upgrade" (101) or the HTTP status code the server answered with instead */
	const attemptUpgrade = (port: number, reqPath: string): Promise<number | "upgrade"> =>
		new Promise((resolve, reject) => {
			const req = http.request({
				port,
				path: reqPath,
				headers: {
					Connection: "Upgrade",
					Upgrade: "websocket",
					"Sec-WebSocket-Key": Buffer.from("0123456789abcdef").toString("base64"),
					"Sec-WebSocket-Version": "13",
					// vlcn options ride the subprotocol as unpadded base64 "key=value" pairs
					"Sec-WebSocket-Protocol": Buffer.from("room=testdb").toString("base64").replaceAll("=", "")
				}
			});
			req.on("upgrade", (_res, socket) => {
				socket.destroy();
				resolve("upgrade");
			});
			req.on("response", (res) => {
				res.resume();
				resolve(res.statusCode ?? 0);
			});
			req.on("error", reject);
			req.end();
		});

	const startServer = async (denied: Set<string>): Promise<number> => {
		tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "version-gate-test-"));
		fs.mkdirSync(path.join(tmpDir, "dbs"));
		fs.mkdirSync(path.join(tmpDir, "schemas"));

		server = http.createServer();
		const wsConfig = {
			dbFolder: path.join(tmpDir, "dbs"),
			schemaFolder: path.join(tmpDir, "schemas"),
			pathPattern: /\/sync/,
			notifyPolling: true
		} satisfies Config;
		attachWebsocketServer(server, wsConfig, undefined, undefined, makeVersionGate(denied));

		await new Promise<void>((resolve) => server!.listen(0, resolve));
		return (server!.address() as { port: number }).port;
	};

	test("denies a listed client version with 401 at the upgrade", async () => {
		const port = await startServer(new Set(["bad001"]));
		expect(await attemptUpgrade(port, "/sync?client_version=bad001")).toBe(401);
	});

	test("upgrades an allowed client version", async () => {
		const port = await startServer(new Set(["bad001"]));
		expect(await attemptUpgrade(port, "/sync?client_version=good02")).toBe("upgrade");
	});

	test("denies unversioned clients only when the sentinel is listed", async () => {
		const port = await startServer(new Set([UNVERSIONED]));
		expect(await attemptUpgrade(port, "/sync")).toBe(401);
	});
});
