import { writable } from "svelte/store";

import type { DB } from "./types";
import { browser } from "$app/environment";

/** A cheap ping to check if the DB is idle (usually takes 3ms, unless DB busy by another request) */
const ping = (db: DB, timeout: number): Promise<boolean> => {
	return new Promise((resolve) => {
		const failTimeout = setTimeout(() => resolve(false), timeout);

		db.exec("SELECT * FROM crsql_master").then(() => {
			if (failTimeout) clearTimeout(failTimeout);
			resolve(true);
		});
	});
};

let checkInterval: NodeJS.Timeout | null = null;

/** A store indicating if the DB is busy (syncing or long running query) */
export const busy = writable(false);

export const init = (db: DB, freq = 200) => {
	checkInterval = setInterval(async () => {
		if (!db) return;

		// Ping usually takes 3ms, so 20ms timeout is plenty
		const ok = await ping(db, 20);
		busy.set(!ok);
	}, freq);
};

export const stop = () => {
	if (checkInterval) clearInterval(checkInterval);
};

const confirmUnload = (e: Event) => {
	if (busy) {
		e.preventDefault();
		e.returnValue = false;
	}
};

/**
 * Prevents user from navigating away while the DB is busy.
 * It shows a generic prompt (changes may not be saved), but it's the best
 * we can do here.
 */
export const preventUnloadIfBusy = () => {
	if (browser) {
		window.addEventListener("beforeunload", confirmUnload);
	}
};

/**
 * Stops the on-unload alert prompt. (Not necessary in practive, but we're being good citizens here)
 */
export const preventUnloadIfBusyStop = () => {
	if (browser) {
		window.removeEventListener("beforeunload", confirmUnload);
	}
};
