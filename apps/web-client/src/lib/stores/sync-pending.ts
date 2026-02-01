import { browser } from "$app/environment";
import { writable } from "svelte/store";

import type { IAppDbRx } from "$lib/app/rx";
import type { DBAsync } from "$lib/db/cr-sqlite/core/types";

export const pendingChangesCount = writable(0);

let currentDb: DBAsync | null = null;
let currentDbid: string | null = null;
let lastSentVersion = 0;
let unsubscribeAny: (() => void) | null = null;
let refreshPromise: Promise<void> | null = null;

const getStorageKey = (dbid: string) => `librocco-sync-last-sent-${dbid}`;

const persistLastSentVersion = () => {
	if (!browser || !currentDbid) return;
	localStorage.setItem(getStorageKey(currentDbid), JSON.stringify(lastSentVersion));
};

const loadLastSentVersion = async (db: DBAsync, dbid: string) => {
	currentDbid = dbid;

	if (browser) {
		const stored = localStorage.getItem(getStorageKey(dbid));
		if (stored) {
			lastSentVersion = Number(JSON.parse(stored)) || 0;
			return;
		}
	}

	try {
		const [[maxLocalVersion]] = await db.execA<[number]>(
			"SELECT COALESCE(MAX(db_version), 0) FROM crsql_changes WHERE site_id = crsql_site_id()"
		);
		lastSentVersion = Number(maxLocalVersion ?? 0);
		persistLastSentVersion();
	} catch {
		lastSentVersion = 0;
	}
};

const refreshPendingCount = async () => {
	if (!currentDb) return;

	if (refreshPromise) return refreshPromise;

	refreshPromise = (async () => {
		try {
			const [result] = await currentDb.execO<{ count: number }>(
				"SELECT COUNT(*) as count FROM crsql_changes WHERE site_id = crsql_site_id() AND db_version > ?",
				[lastSentVersion]
			);
			pendingChangesCount.set(Number(result?.count ?? 0));
		} catch {
			pendingChangesCount.set(0);
		} finally {
			refreshPromise = null;
		}
	})();

	return refreshPromise;
};

export async function attachPendingMonitor(db: DBAsync, rx: IAppDbRx, dbid: string) {
	currentDb = db;
	await loadLastSentVersion(db, dbid);

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

export async function setLastSentVersion(version: number, dbid?: string) {
	if (!currentDbid || (dbid && dbid !== currentDbid)) return;

	if (version > lastSentVersion) {
		lastSentVersion = version;
		persistLastSentVersion();
		await refreshPendingCount();
	}
}

export function resetPendingTracker() {
	unsubscribeAny?.();
	unsubscribeAny = null;
	currentDb = null;
	currentDbid = null;
	lastSentVersion = 0;
	refreshPromise = null;
	pendingChangesCount.set(0);
}
