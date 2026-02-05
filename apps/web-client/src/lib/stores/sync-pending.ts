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

// Error patterns that indicate database corruption or unusable state
const DB_ERROR_PATTERNS = [
	"Could not update table infos",
	"crsql_changes",
	"no such table",
	"database disk image is malformed",
	"database is locked",
	"database or disk is full"
];

const isLocalDbError = (error: unknown): boolean => {
	if (!(error instanceof Error)) return false;
	const message = error.message.toLowerCase();
	return DB_ERROR_PATTERNS.some((pattern) => message.toLowerCase().includes(pattern.toLowerCase()));
};

const refreshPendingCount = async () => {
	if (!currentDb) return;

	if (refreshPromise) return refreshPromise;

	refreshPromise = (async () => {
		try {
			const [result] = await currentDb.execO<{ count: number }>(
				"SELECT COUNT(*) as count FROM crsql_changes WHERE site_id = crsql_site_id() AND db_version > ?",
				[lastAckVersion]
			);
			pendingChangesCount.set(Number(result?.count ?? 0));
		} catch (err) {
			console.error("[sync-pending] Error refreshing pending count:", err);

			// Check if this is a critical database error
			if (isLocalDbError(err)) {
				const message = err instanceof Error ? err.message : String(err);
				console.error("[sync-pending] Local database error detected - marking as incompatible:", message);
				markLocalDbError(`Database error: ${message}`);
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
