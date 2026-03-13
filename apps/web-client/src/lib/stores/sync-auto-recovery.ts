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

/** Writable store tracking sync auto-recovery attempts and their latest outcome. */
export const syncAutoRecovery = writable<SyncAutoRecoveryState>(initialState);

/** Record that an auto-recovery attempt has started. */
export function markAutoRecoveryAttempt(): void {
	syncAutoRecovery.update((state) => ({
		...state,
		lastAttemptAt: Date.now()
	}));
}

/** Record a successful auto-recovery run. */
export function markAutoRecoverySuccess(): void {
	syncAutoRecovery.update((state) => ({
		...state,
		lastResult: "success",
		lastError: undefined
	}));
}

/** Record that auto-recovery ran but no action was needed. */
export function markAutoRecoveryNoop(): void {
	syncAutoRecovery.update((state) => ({
		...state,
		lastResult: "noop",
		lastError: undefined
	}));
}

/** Record a failed auto-recovery attempt with an error message. */
export function markAutoRecoveryFailure(error: unknown): void {
	const message = error instanceof Error ? error.message : String(error);
	syncAutoRecovery.update((state) => ({
		...state,
		lastResult: "failure",
		lastError: message
	}));
}

/** Reset auto-recovery state to initial values. */
export function resetAutoRecoveryState(): void {
	syncAutoRecovery.set(initialState);
}
