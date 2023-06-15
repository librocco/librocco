import { writable } from "svelte/store";
import type { Toaster } from "./types";

export const toasters = new Map<string, Toaster>();

// TODO: start with initial[] of toasts
/**
 * Sets up toaster store and adds it to toaster context
 */
export const createToaster = (target = "default") => {
	const toasterStore = createToasterStore();

	// TODO: overriding old toaster
	toasters.set(target, { toaster: toasterStore });

	return toasterStore;
};

// TODO: type toast store. Should require certain properties but allow extension with e.g type

/**
 * Creates a toaster store to hold and manage toasts
 */
export const createToasterStore = () => {
	const toasts = writable([]);

	const clean = () => {
		toasts.set([]);
	};

	const pop = (id) => {
		toasts.update((all) => all.filter((t) => t.id !== id));
	};

	const push = (_toast) => {
		// Create a unique ID so we can easily find/remove it
		// if it is dismissible/has a timeout.
		const id = Date.now();

		const toast = { id, ..._toast };

		toasts.update((all) => [toast, ...all]);
	};

	return {
		subscribe: toasts.subscribe,
		pop,
		push,
		clean
	};
};
