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

export function markAutoRecoveryAttempt() {
	syncAutoRecovery.update((state) => ({
		...state,
		lastAttemptAt: Date.now()
	}));
}

export function markAutoRecoverySuccess() {
	syncAutoRecovery.update((state) => ({
		...state,
		lastResult: "success",
		lastError: undefined
	}));
}

export function markAutoRecoveryNoop() {
	syncAutoRecovery.update((state) => ({
		...state,
		lastResult: "noop",
		lastError: undefined
	}));
}

export function markAutoRecoveryFailure(error: unknown) {
	const message = error instanceof Error ? error.message : String(error);
	syncAutoRecovery.update((state) => ({
		...state,
		lastResult: "failure",
		lastError: message
	}));
}

export function resetAutoRecoveryState() {
	syncAutoRecovery.set(initialState);
}

