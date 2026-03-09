import { writable } from "svelte/store";

export type SyncAutoRecoveryState = {
	lastAttemptAt: number | null;
	lastResult: "success" | "noop" | "failure" | null;
	lastError?: string;
};

const initialState: SyncAutoRecoveryState = {
	lastAttemptAt: null,
	lastResult: null
};

export const syncAutoRecovery = writable<SyncAutoRecoveryState>(initialState);

/**
 * Sets `lastAttemptAt` to the current timestamp in the `syncAutoRecovery` store while preserving other state fields.
 */
export function markAutoRecoveryAttempt() {
	syncAutoRecovery.update((state) => ({
		...state,
		lastAttemptAt: Date.now()
	}));
}

/**
 * Record that the most recent auto-recovery attempt succeeded.
 *
 * Sets the store's `lastResult` to `"success"` and clears any `lastError`.
 */
export function markAutoRecoverySuccess() {
	syncAutoRecovery.update((state) => ({
		...state,
		lastResult: "success",
		lastError: undefined
	}));
}

/**
 * Marks the auto-recovery run as a no-op.
 *
 * Updates the `syncAutoRecovery` store to set `lastResult` to `"noop"` and clear `lastError`.
 */
export function markAutoRecoveryNoop() {
	syncAutoRecovery.update((state) => ({
		...state,
		lastResult: "noop",
		lastError: undefined
	}));
}

/**
 * Record an auto-recovery failure and save its message to the store.
 *
 * Updates the `syncAutoRecovery` store by setting `lastResult` to `"failure"`
 * and `lastError` to a string derived from the provided `error`.
 *
 * @param error - The error to record; if `error` is an `Error` its `message` is used, otherwise `String(error)` is used
 */
export function markAutoRecoveryFailure(error: unknown) {
	const message = error instanceof Error ? error.message : String(error);
	syncAutoRecovery.update((state) => ({
		...state,
		lastResult: "failure",
		lastError: message
	}));
}

/**
 * Reset the auto-recovery state store to its initial values.
 *
 * Sets `lastAttemptAt` and `lastResult` back to their initial values and clears any `lastError`.
 */
export function resetAutoRecoveryState() {
	syncAutoRecovery.set(initialState);
}
