import { persisted } from "svelte-local-storage-store";
import { get, writable } from "svelte/store";

import { schemaVersion } from "$lib/db/cr-sqlite/db";

const REMOTE_SITE_IDS_KEY = "librocco-remote-site-ids";

export type SyncIncompatibilityReason =
	| "remote_reset"
	| "schema_mismatch"
	| "remote_unreachable"
	| "missing_metadata"
	| "handshake_failed"
	| "apply_failed"
	| "local_db_error";

export type SyncCompatibilityState =
	| { status: "unknown" }
	| { status: "checking" }
	| { status: "compatible"; remoteSiteId: string; remoteSchemaVersion?: string | null; verified: boolean }
	| { status: "incompatible"; reason: SyncIncompatibilityReason; message?: string };

export const syncCompatibility = writable<SyncCompatibilityState>({ status: "unknown" });

const remoteSiteIds = persisted<Record<string, string>>(REMOTE_SITE_IDS_KEY, {});

type RemoteMeta = {
	siteId?: string;
	schemaName?: string;
	schemaVersion?: string;
};

class RemoteMetaError extends Error {
	constructor(
		message: string,
		readonly code: "unavailable" | "network"
	) {
		super(message);
	}
}

const normalizeRemoteSiteId = (raw: string | undefined) => {
	if (!raw) return "";
	// Remote meta returns X'hex' strings; strip the X'' wrapper if present
	if (raw.startsWith("X'") && raw.endsWith("'")) {
		return raw.slice(2, -1).toLowerCase();
	}
	return raw.toLowerCase();
};

const buildMetaUrl = (syncUrl: string, dbid: string) => {
	const url = new URL(syncUrl);
	if (url.protocol === "ws:") url.protocol = "http:";
	if (url.protocol === "wss:") url.protocol = "https:";
	url.pathname = `/${dbid}/meta`;
	url.search = "";
	url.hash = "";
	return url.toString();
};

const localSchemaVersion = String(schemaVersion);

type RemoteInfo = { siteId?: string; schemaVersion?: string | null; verified?: boolean };

const applyRemoteInfo = (dbid: string, info: RemoteInfo) => {
	const rememberedRemote = get(remoteSiteIds)[dbid];
	const remoteSiteId = normalizeRemoteSiteId(info.siteId);

	if (!remoteSiteId) {
		syncCompatibility.set({ status: "incompatible", reason: "missing_metadata", message: "Missing remote site_id" });
		return { ok: false as const, reason: "missing_metadata" as const };
	}

	if (info.schemaVersion && info.schemaVersion !== localSchemaVersion) {
		syncCompatibility.set({
			status: "incompatible",
			reason: "schema_mismatch",
			message: `Remote schema ${info.schemaVersion} !== local ${localSchemaVersion}`
		});
		return { ok: false as const, reason: "schema_mismatch" as const };
	}

	if (rememberedRemote && rememberedRemote !== remoteSiteId) {
		syncCompatibility.set({
			status: "incompatible",
			reason: "remote_reset",
			message: "Remote DB changed identity since last sync"
		});
		return { ok: false as const, reason: "remote_reset" as const };
	}

	remoteSiteIds.update((ids) => ({ ...ids, [dbid]: remoteSiteId }));
	syncCompatibility.set({
		status: "compatible",
		remoteSiteId,
		remoteSchemaVersion: info.schemaVersion ?? null,
		verified: info.verified ?? true
	});
	return { ok: true as const, remoteSiteId, remoteSchemaVersion: info.schemaVersion ?? null, verified: info.verified ?? true };
};

async function fetchRemoteMeta(syncUrl: string, dbid: string, fetchImpl: typeof fetch = fetch): Promise<RemoteMeta> {
	const url = buildMetaUrl(syncUrl, dbid);
	const resp = await fetchImpl(url);
	if (!resp.ok) {
		let message = `Meta request failed (${resp.status})`;
		try {
			const body = await resp.json();
			if (typeof body?.message === "string") {
				message = body.message;
			}
		} catch {
			// ignore parse errors
		}

		const code = resp.status === 404 || resp.status === 500 ? "unavailable" : "network";
		throw new RemoteMetaError(message, code);
	}
	return (await resp.json()) as RemoteMeta;
}

export async function checkSyncCompatibility(args: {
	dbid: string;
	syncUrl: string;
	fetchImpl?: typeof fetch;
	mode?: "background" | "strict";
}) {
	const { dbid, syncUrl, fetchImpl, mode = "background" } = args;
	const previous = get(syncCompatibility);
	if (mode === "strict" || previous.status === "unknown" || previous.status === "checking") {
		syncCompatibility.set({ status: "checking" });
	}

	try {
		const meta = await fetchRemoteMeta(syncUrl, dbid, fetchImpl);
		return applyRemoteInfo(dbid, { siteId: meta.siteId, schemaVersion: meta.schemaVersion, verified: true });
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		if (err instanceof RemoteMetaError && err.code === "unavailable" && mode === "background") {
			// Allow sync to proceed; rely on WS handshake to resolve compatibility
			syncCompatibility.set(previous);
			return { ok: false as const, pendingMeta: true };
		}

		if (mode === "strict") {
			syncCompatibility.set({ status: "incompatible", reason: "remote_unreachable", message });
		} else {
			syncCompatibility.set(previous);
		}
		return { ok: false as const, error: err };
	}
}

export function resetSyncCompatibility(dbid: string) {
	remoteSiteIds.update((ids) => {
		const next = { ...ids };
		delete next[dbid];
		return next;
	});
	syncCompatibility.set({ status: "unknown" });
}

export function markCompatibilityChecking() {
	syncCompatibility.set({ status: "checking" });
}

/**
 * Mark sync as incompatible due to local database error.
 * This is used when the local database is in a corrupt or unusable state
 * (e.g., crsql_changes table is inaccessible).
 */
export function markLocalDbError(message: string) {
	syncCompatibility.set({
		status: "incompatible",
		reason: "local_db_error",
		message
	});
}

export function applyHandshakeStatus(
	dbid: string,
	status: {
		ok: boolean;
		siteId?: string;
		schemaVersion?: string;
		schemaHash?: string;
		stage?: string;
		reason?: string;
		message?: string;
	}
) {
	console.info("[sync] applyHandshakeStatus", { dbid, status });
	if (!status.ok) {
		const message = status.message ?? "Sync handshake failed";
		syncCompatibility.set({
			status: "incompatible",
			reason:
				status.reason === "schema_mismatch" ? "schema_mismatch" : status.reason === "apply_failed" ? "apply_failed" : "handshake_failed",
			message
		});
		return { ok: false as const };
	}

	const verified = status.stage === "steady" || status.stage === "apply_ack" || status.stage == null;
	const schemaVersionStr = status.schemaVersion ?? status.schemaHash ?? undefined;

	if (schemaVersionStr && schemaVersionStr !== localSchemaVersion) {
		syncCompatibility.set({
			status: "incompatible",
			reason: "schema_mismatch",
			message: `Remote schema ${schemaVersionStr} !== local ${localSchemaVersion}`
		});
		return { ok: false as const };
	}

	return applyRemoteInfo(dbid, { siteId: status.siteId, schemaVersion: schemaVersionStr, verified });
}
