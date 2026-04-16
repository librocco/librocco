import { writable } from "svelte/store";

import type { IAppDbRx } from "$lib/app/rx";
import type { DBAsync } from "$lib/db/cr-sqlite/core/types";
import { getActiveOutboundNoteCount } from "$lib/db/cr-sqlite/note";

/** Number of uncommitted outbound ("sale") notes. Drives the sidebar badge. */
export const activeOutboundNoteCount = writable(0);

let currentDb: DBAsync | null = null;
let unsubscribe: (() => void) | null = null;
let refreshPromise: Promise<void> | null = null;

const refresh = async () => {
	if (!currentDb) return;
	if (refreshPromise) return refreshPromise;

	refreshPromise = (async () => {
		try {
			const count = await getActiveOutboundNoteCount(currentDb);
			activeOutboundNoteCount.set(count);
		} catch (err) {
			console.error("[active-outbound-count] refresh failed:", err);
			activeOutboundNoteCount.set(0);
		} finally {
			refreshPromise = null;
		}
	})();

	return refreshPromise;
};

/**
 * Attach the count monitor to a live DB: subscribes to `note` table changes and keeps
 * {@link activeOutboundNoteCount} up to date. Returns a detach function.
 *
 * Call this on mount, and again whenever the app-level DB is swapped out (e.g. on
 * `rx.onInvalidate`) — mirrors the pattern used by `attachPendingMonitor`.
 */
export async function attachActiveOutboundCountMonitor(db: DBAsync, rx: IAppDbRx) {
	currentDb = db;

	unsubscribe?.();
	unsubscribe = rx.onRange(["note"], () => {
		void refresh();
	});

	await refresh();

	return () => {
		unsubscribe?.();
		unsubscribe = null;
		if (currentDb === db) {
			currentDb = null;
		}
	};
}

export function resetActiveOutboundCount() {
	unsubscribe?.();
	unsubscribe = null;
	currentDb = null;
	refreshPromise = null;
	activeOutboundNoteCount.set(0);
}
