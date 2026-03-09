import { get, writable } from "svelte/store";

import type { DBAsync } from "$lib/db/cr-sqlite/core/types";

const QUICK_CHECK_INTERVAL_MS = 180_000;

type HealthStatus = "unknown" | "checking" | "ok" | "warning" | "error";

export type LocalDbHealthState = {
	status: HealthStatus;
	lastQuickCheckAt: number | null;
	lastIntegrityCheckAt: number | null;
	suspected: boolean;
	message?: string;
};

export type LocalDbIntegrityResult = {
	ok: boolean;
	message: string;
};

const initialState: LocalDbHealthState = {
	status: "unknown",
	lastQuickCheckAt: null,
	lastIntegrityCheckAt: null,
	suspected: false
};

export const localDbHealth = writable<LocalDbHealthState>(initialState);

let currentDb: DBAsync | null = null;
let quickCheckTimer: ReturnType<typeof setInterval> | null = null;
let runningQuickCheck: Promise<void> | null = null;

/**
 * Update the local database health store with the result of a quick integrity check.
 *
 * Sets the store's status to `"ok"` when `ok` is true or `"warning"` when `ok` is false, records the timestamp of the quick check, sets `suspected` to the negation of `ok`, and stores the provided `message`.
 *
 * @param ok - `true` if the quick check passed (`"ok"`), `false` otherwise
 * @param message - A human-readable message describing the quick check result
 */
function setQuickCheckResult(ok: boolean, message: string) {
	const now = Date.now();
	localDbHealth.update((state) => ({
		...state,
		status: ok ? "ok" : "warning",
		lastQuickCheckAt: now,
		suspected: !ok,
		message
	}));
}

/**
 * Performs a quick integrity check (PRAGMA quick_check) on the provided local SQLite database and updates the localDbHealth store.
 *
 * If a quick check is already in progress, waits for it to complete and returns that result.
 *
 * @param db - The database connection to run the quick check against
 * @returns `true` if the database quick check passed, `false` otherwise
 */
export async function runLocalDbQuickCheck(db: DBAsync): Promise<boolean> {
	if (runningQuickCheck) {
		await runningQuickCheck;
		return get(localDbHealth).status === "ok";
	}

	runningQuickCheck = (async () => {
		try {
			localDbHealth.update((state) => ({ ...state, status: state.status === "unknown" ? "checking" : state.status }));
			const rows = await db.execA<[string]>("PRAGMA quick_check");
			const checks = rows.map((row) => row[0]);
			const ok = checks.length === 1 && checks[0] === "ok";
			setQuickCheckResult(ok, ok ? "Local DB quick check passed." : `Local DB quick check failed: ${checks.join(", ")}`);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			setQuickCheckResult(false, `Local DB quick check error: ${message}`);
		}
	})();

	try {
		await runningQuickCheck;
		return get(localDbHealth).status === "ok";
	} finally {
		runningQuickCheck = null;
	}
}

/**
 * Performs a PRAGMA integrity_check on the provided local SQLite database and updates the local DB health store.
 *
 * @param db - The DBAsync instance to run the integrity check against.
 * @returns An object with `ok` set to `true` if the integrity check returned a single `"ok"` row, `false` otherwise; and `message` describing the pass, failure details, or error.
 */
export async function runLocalDbIntegrityCheck(db: DBAsync): Promise<LocalDbIntegrityResult> {
	const now = Date.now();
	localDbHealth.update((state) => ({ ...state, status: "checking" }));

	try {
		const rows = await db.execA<[string]>("PRAGMA integrity_check");
		const checks = rows.map((row) => row[0]);
		const ok = checks.length === 1 && checks[0] === "ok";
		const message = ok ? "Local DB integrity check passed." : `Local DB integrity check failed: ${checks.join(", ")}`;

		localDbHealth.update((state) => ({
			...state,
			status: ok ? "ok" : "error",
			lastIntegrityCheckAt: now,
			suspected: !ok,
			message
		}));

		return { ok, message };
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		localDbHealth.update((state) => ({
			...state,
			status: "error",
			lastIntegrityCheckAt: now,
			suspected: true,
			message: `Local DB integrity check error: ${message}`
		}));
		return { ok: false, message: `Local DB integrity check error: ${message}` };
	}
}

/**
 * Attach a periodic quick-health monitor to the provided local database.
 *
 * Sets the provided database as the current target, runs an initial quick check,
 * and schedules recurring quick checks at a fixed interval.
 *
 * @param db - The local `DBAsync` instance to monitor
 * @returns A function that stops the periodic checks and clears the internal database reference
 */
export async function attachLocalDbHealthMonitor(db: DBAsync) {
	currentDb = db;
	await runLocalDbQuickCheck(db);

	if (quickCheckTimer) {
		clearInterval(quickCheckTimer);
	}
	quickCheckTimer = setInterval(() => {
		if (currentDb) {
			void runLocalDbQuickCheck(currentDb);
		}
	}, QUICK_CHECK_INTERVAL_MS);

	return () => {
		if (quickCheckTimer) {
			clearInterval(quickCheckTimer);
			quickCheckTimer = null;
		}
		if (currentDb === db) {
			currentDb = null;
		}
	};
}

/**
 * Stop monitoring and restore local database health state to its initial values.
 *
 * Clears any active periodic quick-check timer, drops the stored current database and running quick-check reference, and resets the `localDbHealth` store to the initial state.
 */
export function resetLocalDbHealth() {
	if (quickCheckTimer) {
		clearInterval(quickCheckTimer);
		quickCheckTimer = null;
	}
	currentDb = null;
	runningQuickCheck = null;
	localDbHealth.set(initialState);
}
