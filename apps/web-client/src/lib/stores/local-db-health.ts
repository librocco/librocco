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
let runningQuickCheckDb: DBAsync | null = null;

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

export async function runLocalDbQuickCheck(db: DBAsync): Promise<boolean> {
	if (runningQuickCheck) {
		if (runningQuickCheckDb === db) {
			await runningQuickCheck;
			return get(localDbHealth).status === "ok";
		}
	}

	runningQuickCheckDb = db;
	const quickCheckPromise = (async () => {
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
	runningQuickCheck = quickCheckPromise;

	try {
		await quickCheckPromise;
		return get(localDbHealth).status === "ok";
	} finally {
		if (runningQuickCheck === quickCheckPromise) {
			runningQuickCheck = null;
			runningQuickCheckDb = null;
		}
	}
}

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

export function resetLocalDbHealth() {
	if (quickCheckTimer) {
		clearInterval(quickCheckTimer);
		quickCheckTimer = null;
	}
	currentDb = null;
	runningQuickCheck = null;
	localDbHealth.set(initialState);
}
