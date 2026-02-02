import { persisted } from "svelte-local-storage-store";
import { get, writable } from "svelte/store";

import { schemaVersion } from "$lib/db/cr-sqlite/db";

const REMOTE_SITE_IDS_KEY = "librocco-remote-site-ids";

export type SyncIncompatibilityReason = "remote_reset" | "schema_mismatch" | "remote_unreachable" | "missing_metadata";

export type SyncCompatibilityState =
	| { status: "unknown" }
	| { status: "checking" }
	| { status: "compatible"; remoteSiteId: string; remoteSchemaVersion?: string | null }
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

export async function checkSyncCompatibility(args: { dbid: string; syncUrl: string; fetchImpl?: typeof fetch }) {
	const { dbid, syncUrl, fetchImpl } = args;
	syncCompatibility.set({ status: "checking" });

	const localSchemaVersion = String(schemaVersion);

	const rememberedRemote = get(remoteSiteIds)[dbid];

	try {
		const meta = await fetchRemoteMeta(syncUrl, dbid, fetchImpl);
		const remoteSiteId = normalizeRemoteSiteId(meta.siteId);

		if (!remoteSiteId) {
			syncCompatibility.set({ status: "incompatible", reason: "missing_metadata", message: "Missing remote site_id" });
			return { ok: false };
		}

		if (meta.schemaVersion && meta.schemaVersion !== localSchemaVersion) {
			syncCompatibility.set({
				status: "incompatible",
				reason: "schema_mismatch",
				message: `Remote schema ${meta.schemaVersion} !== local ${localSchemaVersion}`
			});
			return { ok: false };
		}

		if (rememberedRemote && rememberedRemote !== remoteSiteId) {
			syncCompatibility.set({
				status: "incompatible",
				reason: "remote_reset",
				message: "Remote DB changed identity since last sync"
			});
			return { ok: false };
		}

		remoteSiteIds.update((ids) => ({ ...ids, [dbid]: remoteSiteId }));
		syncCompatibility.set({ status: "compatible", remoteSiteId, remoteSchemaVersion: meta.schemaVersion });
		return { ok: true, remoteSiteId };
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		if (!rememberedRemote && err instanceof RemoteMetaError && err.code === "unavailable") {
			// Allow first-run to proceed even if meta isn't ready; we'll re-fetch after sync completes
			syncCompatibility.set({ status: "checking" });
			return { ok: true, pendingMeta: true };
		}

		syncCompatibility.set({ status: "incompatible", reason: "remote_unreachable", message });
		return { ok: false, error: err };
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
