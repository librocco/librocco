import { writable } from "svelte/store";

import type { IAppDbRx } from "$lib/app/rx";
import type { DBAsync } from "$lib/db/cr-sqlite/core/types";
import { getActiveOutboundNoteCount } from "$lib/db/cr-sqlite/note";

/** Number of uncommitted outbound ("sale") notes. Drives the sidebar badge. */
export const activeOutboundNoteCount = writable(0);

let currentDb: DBAsync | null = null;
let unsubscribe: (() => void) | null = null;
let refreshPromise: Promise<void> | null = null;
let refreshPending = false;

const refresh = async () => {
	if (!currentDb) return;
	if (refreshPromise) {
		// An onRange event landed mid-flight — queue a trailing re-run so the latest
		// DB state is read after the current one resolves.
		refreshPending = true;
		return refreshPromise;
	}

	refreshPromise = (async () => {
		try {
			const count = await getActiveOutboundNoteCount(currentDb);
			activeOutboundNoteCount.set(count);
		} catch (err) {
			// Keep the previous value on transient read failures; resetting to 0 would
			// be indistinguishable from a genuine empty state in the sidebar badge.
			console.error("[active-outbound-count] refresh failed:", err);
		} finally {
			refreshPromise = null;
			if (refreshPending) {
				refreshPending = false;
				void refresh();
			}
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
	// Capture this attach's subscription locally so the returned detach only tears
	// down its own handle — the module-scoped `unsubscribe` may point at a later
	// monitor by the time this detach runs (HMR, remount, re-attach on DB swap).
	const localUnsubscribe = rx.onRange(["note"], () => {
		void refresh();
	});
	unsubscribe = localUnsubscribe;

	await refresh();

	return () => {
		localUnsubscribe();
		if (unsubscribe === localUnsubscribe) {
			unsubscribe = null;
		}
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
