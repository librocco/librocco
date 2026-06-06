/** @vitest-environment node */
import { get } from "svelte/store";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// svelte-local-storage-store uses localStorage which isn't available in node.
// Replace persisted() with a plain writable so remoteSiteIds is in-memory only.
vi.mock("svelte-local-storage-store", () => {
	function mkWritable<T>(init: T) {
		let val = init;
		const subs = new Set<(v: T) => void>();
		return {
			subscribe: (cb: (v: T) => void) => {
				subs.add(cb);
				cb(val);
				return () => subs.delete(cb);
			},
			set: (v: T) => {
				val = v;
				for (const s of subs) s(v);
			},
			update: (fn: (v: T) => T) => {
				val = fn(val);
				for (const s of subs) s(val);
			}
		};
	}
	return { persisted: (_key: unknown, init: unknown) => mkWritable(init) };
});

// Avoid pulling in WASM / worker initialisation from cr-sqlite/db.
vi.mock("$lib/db/cr-sqlite/db", () => ({ schemaVersion: 42 }));

import { applyHandshakeStatus, checkSyncCompatibility, resetSyncCompatibility, syncCompatibility } from "../sync-compatibility";

const TEST_DBID = "test-db-compat";
const TEST_SYNC_URL = "ws://localhost:8080";
const LOCAL_SCHEMA_VERSION = "42"; // must match the mocked schemaVersion above

const makeFetch =
	(status: number, body: object = {}): typeof fetch =>
	() =>
		Promise.resolve(new Response(JSON.stringify(body), { status }));

const makeFailFetch =
	(message: string): typeof fetch =>
	() =>
		Promise.reject(new Error(message));

describe("checkSyncCompatibility – background mode", () => {
	beforeEach(() => {
		syncCompatibility.set({ status: "unknown" });
		resetSyncCompatibility(TEST_DBID);
	});

	afterEach(() => {
		syncCompatibility.set({ status: "unknown" });
		resetSyncCompatibility(TEST_DBID);
	});

	it("404 from meta endpoint restores previous state and returns pendingMeta:true", async () => {
		syncCompatibility.set({ status: "compatible", remoteSiteId: "existing-site", remoteSchemaVersion: null, verified: true });

		const result = await checkSyncCompatibility({
			dbid: TEST_DBID,
			syncUrl: TEST_SYNC_URL,
			mode: "background",
			fetchImpl: makeFetch(404, { message: "Not Found" })
		});

		expect(result).toEqual({ ok: false, pendingMeta: true });
		expect(get(syncCompatibility)).toMatchObject({ status: "compatible", remoteSiteId: "existing-site" });
	});

	it("500 from meta endpoint restores previous state and returns pendingMeta:true", async () => {
		syncCompatibility.set({ status: "compatible", remoteSiteId: "existing-site", remoteSchemaVersion: null, verified: true });

		const result = await checkSyncCompatibility({
			dbid: TEST_DBID,
			syncUrl: TEST_SYNC_URL,
			mode: "background",
			fetchImpl: makeFetch(500)
		});

		expect(result).toEqual({ ok: false, pendingMeta: true });
		expect(get(syncCompatibility)).toMatchObject({ status: "compatible", remoteSiteId: "existing-site" });
	});

	it("network-level failure restores previous state", async () => {
		syncCompatibility.set({ status: "compatible", remoteSiteId: "existing-site", remoteSchemaVersion: null, verified: true });

		const result = await checkSyncCompatibility({
			dbid: TEST_DBID,
			syncUrl: TEST_SYNC_URL,
			mode: "background",
			fetchImpl: makeFailFetch("Network error")
		});

		expect(result).toMatchObject({ ok: false, error: expect.any(Error) });
		expect(get(syncCompatibility)).toMatchObject({ status: "compatible", remoteSiteId: "existing-site" });
	});

	it("schema mismatch in meta response sets incompatible/schema_mismatch", async () => {
		const result = await checkSyncCompatibility({
			dbid: TEST_DBID,
			syncUrl: TEST_SYNC_URL,
			mode: "background",
			fetchImpl: makeFetch(200, { siteId: "abc123", schemaVersion: "999999" })
		});

		expect(result).toEqual({ ok: false, reason: "schema_mismatch" });
		expect(get(syncCompatibility)).toMatchObject({ status: "incompatible", reason: "schema_mismatch" });
	});

	it("missing siteId in meta response sets incompatible/missing_metadata", async () => {
		const result = await checkSyncCompatibility({
			dbid: TEST_DBID,
			syncUrl: TEST_SYNC_URL,
			mode: "background",
			fetchImpl: makeFetch(200, { schemaVersion: LOCAL_SCHEMA_VERSION })
		});

		expect(result).toEqual({ ok: false, reason: "missing_metadata" });
		expect(get(syncCompatibility)).toMatchObject({ status: "incompatible", reason: "missing_metadata" });
	});
});

describe("checkSyncCompatibility – strict mode", () => {
	beforeEach(() => {
		syncCompatibility.set({ status: "unknown" });
		resetSyncCompatibility(TEST_DBID);
	});

	afterEach(() => {
		syncCompatibility.set({ status: "unknown" });
		resetSyncCompatibility(TEST_DBID);
	});

	it("404 from meta endpoint sets incompatible/remote_unreachable", async () => {
		const result = await checkSyncCompatibility({
			dbid: TEST_DBID,
			syncUrl: TEST_SYNC_URL,
			mode: "strict",
			fetchImpl: makeFetch(404, { message: "Not Found" })
		});

		expect(result).toMatchObject({ ok: false, error: expect.any(Error) });
		expect(get(syncCompatibility)).toMatchObject({ status: "incompatible", reason: "remote_unreachable" });
	});
});

describe("applyHandshakeStatus", () => {
	beforeEach(() => {
		syncCompatibility.set({ status: "unknown" });
		resetSyncCompatibility(TEST_DBID);
	});

	afterEach(() => {
		syncCompatibility.set({ status: "unknown" });
		resetSyncCompatibility(TEST_DBID);
	});

	it("ok=false with reason=peer_mismatch sets incompatible/remote_reset", () => {
		applyHandshakeStatus(TEST_DBID, { ok: false, reason: "peer_mismatch", message: "Peer identity changed" });

		expect(get(syncCompatibility)).toMatchObject({ status: "incompatible", reason: "remote_reset" });
	});

	it("ok=true sets compatible and returns ok:true", () => {
		const result = applyHandshakeStatus(TEST_DBID, { ok: true, siteId: "abc123", stage: "steady" });

		expect(result).toMatchObject({ ok: true });
		expect(get(syncCompatibility)).toMatchObject({ status: "compatible" });
	});
});
