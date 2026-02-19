import { browser } from "$app/environment";
import { writable } from "svelte/store";

import type { IAppDbRx } from "$lib/app/rx";
import type { DBAsync } from "$lib/db/cr-sqlite/core/types";
import { markLocalDbError } from "./sync-compatibility";

export const pendingChangesCount = writable(0);

let currentDb: DBAsync | null = null;
let currentDbid: string | null = null;
let lastAckVersion = 0;
let unsubscribeAny: (() => void) | null = null;
let refreshPromise: Promise<void> | null = null;

const getAckStorageKey = (dbid: string) => `librocco-sync-last-ack-${dbid}`;
const getLegacyStorageKey = (dbid: string) => `librocco-sync-last-sent-${dbid}`;

const persistLastAckVersion = () => {
	if (!browser || !currentDbid) return;
	localStorage.setItem(getAckStorageKey(currentDbid), JSON.stringify(lastAckVersion));
};

const loadLastAckVersion = async (dbid: string) => {
	currentDbid = dbid;

	if (browser) {
		const stored = localStorage.getItem(getAckStorageKey(dbid)) ?? localStorage.getItem(getLegacyStorageKey(dbid));
		if (stored != null) {
			lastAckVersion = Number(JSON.parse(stored)) || 0;
			persistLastAckVersion();
			return;
		}
	}

	lastAckVersion = 0;
};

// Error patterns that indicate permanent database corruption (nuke required)
const PERMANENT_ERROR_PATTERNS = ["database disk image is malformed", "database or disk is full"];

// Error patterns that may be transient (retry before giving up)
const TRANSIENT_ERROR_PATTERNS = ["Could not update table infos", "crsql_changes", "no such table", "database is locked"];

export type LocalDbErrorKind = "none" | "transient" | "permanent";

export const classifyLocalDbError = (error: unknown): LocalDbErrorKind => {
	if (!(error instanceof Error)) return "none";
	const message = error.message.toLowerCase();
	if (PERMANENT_ERROR_PATTERNS.some((pattern) => message.includes(pattern.toLowerCase()))) {
		return "permanent";
	}
	if (TRANSIENT_ERROR_PATTERNS.some((pattern) => message.includes(pattern.toLowerCase()))) {
		return "transient";
	}
	return "none";
};

const RETRY_COUNT = 2;
const RETRY_DELAY_MS = 300;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const refreshPendingCount = async () => {
	if (!currentDb) return;

	if (refreshPromise) return refreshPromise;

	refreshPromise = (async () => {
		try {
			let lastError: unknown = null;

			for (let attempt = 0; attempt < RETRY_COUNT; attempt++) {
				try {
					const [result] = await currentDb.execO<{ count: number }>(
						"SELECT COUNT(*) as count FROM crsql_changes WHERE site_id = crsql_site_id() AND db_version > ?",
						[lastAckVersion]
					);
					pendingChangesCount.set(Number(result?.count ?? 0));
					return;
				} catch (err) {
					lastError = err;
					const errKind = classifyLocalDbError(err);

					// Permanent errors: don't retry, mark immediately
					if (errKind === "permanent") {
						break;
					}

					// Non-DB errors: don't retry
					if (errKind === "none") {
						console.error("[sync-pending] Error refreshing pending count:", err);
						pendingChangesCount.set(0);
						return;
					}

					// Transient DB error: retry (silently on first attempt — cr-sqlite's
					// crsql_changes virtual table may not be ready immediately after DB init)
					if (attempt < RETRY_COUNT - 1) {
						if (attempt > 0) {
							console.warn(`[sync-pending] Transient error (attempt ${attempt + 1}/${RETRY_COUNT}), retrying:`, err);
						}
						await delay(RETRY_DELAY_MS);
					}
				}
			}

			// All retries exhausted or permanent error.
			// We only mark incompatibility for permanent local DB errors. Transient lock/virtual table
			// races should degrade sync state (e.g. connecting/stuck) but must not force nuke/resync.
			const finalKind = classifyLocalDbError(lastError);
			if (finalKind === "permanent") {
				const message = lastError instanceof Error ? lastError.message : String(lastError);
				console.error("[sync-pending] Local database error detected - marking as incompatible:", message);
				markLocalDbError(`Database error: ${message}`);
			} else if (finalKind === "transient") {
				console.warn("[sync-pending] Transient DB error while computing pending changes; keeping sync compatibility unchanged");
			}

			pendingChangesCount.set(0);
		} finally {
			refreshPromise = null;
		}
	})();

	return refreshPromise;
};

export async function attachPendingMonitor(db: DBAsync, rx: IAppDbRx, dbid: string) {
	currentDb = db;
	await loadLastAckVersion(dbid);

	unsubscribeAny?.();
	unsubscribeAny = rx.onAny(() => {
		void refreshPendingCount();
	});

	await refreshPendingCount();

	return () => {
		unsubscribeAny?.();
		unsubscribeAny = null;
		if (currentDb === db) {
			currentDb = null;
		}
	};
}

export async function setLastAckedVersion(version: number, dbid?: string) {
	if (!currentDbid || (dbid && dbid !== currentDbid)) return;

	if (version > lastAckVersion) {
		lastAckVersion = version;
		persistLastAckVersion();
		await refreshPendingCount();
	}
}

export function resetPendingTracker() {
	unsubscribeAny?.();
	unsubscribeAny = null;
	currentDb = null;
	currentDbid = null;
	lastAckVersion = 0;
	refreshPromise = null;
	pendingChangesCount.set(0);
}
