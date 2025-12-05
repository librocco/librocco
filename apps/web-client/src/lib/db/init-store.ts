import { writable, get } from "svelte/store";
import { browser } from "$app/environment";

/**
 * Phases of DB initialization:
 * - idle: Not started
 * - loading: Loading DB/WASM
 * - migrating: Running auto-migration
 * - ready: DB ready for use
 * - error: Unrecoverable error (requires nuke)
 */
export type InitPhase = "idle" | "loading" | "migrating" | "ready" | "error";

export type InitState = {
	phase: InitPhase;
	error: Error | null;
};

const initialState: InitState = {
	phase: "idle",
	error: null
};

/**
 * Store tracking DB initialization state.
 * Used to communicate progress to the splash screen and control sync startup.
 */
function createInitStore() {
	const { subscribe, set } = writable<InitState>(initialState);

	return {
		subscribe,

		/**
		 * Set the current initialization phase.
		 * Notifies the splash screen via window callback.
		 */
		setPhase: (phase: InitPhase, error?: Error) => {
			set({ phase, error: error || null });

			// Notify splash screen in app.html
			if (browser) {
				(window as any).__dbInitUpdate?.(phase, error);
			}
		},

		/** Reset to idle state */
		reset: () => {
			set(initialState);
		},

		/** Get current state synchronously */
		get: () => get({ subscribe })
	};
}

export const initStore = createInitStore();
