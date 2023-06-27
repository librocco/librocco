import { writable } from "svelte/store";
import type { Toaster, ToastOptions } from "./types";

export const toasters = new Map<string, Toaster>();

// TODO: start with initial[] of toasts
/**
 * Sets up toaster store and adds it to toaster context
 */
export const createToaster = <T extends ToastOptions>(target = "default") => {
	const toasterStore = createToasterStore<T>();

	// TODO: overriding old toaster
	toasters.set(target, { toaster: toasterStore });

	return toasterStore;
};

// TODO: type toast store. Should require certain properties but allow extension with e.g type

/**
 * Creates a toaster store to hold and manage toasts
 */
export const createToasterStore = <T extends ToastOptions>() => {
	const toasts = writable<(T & { id: string })[]>();

	const clean = () => {
		toasts.set([]);
	};

	const pop = (id: string) => {
		toasts.update((all) => all.filter((t) => t.id !== id));
	};

	let count = 0;

	const push = (toast: T) => {
		// Create a unique ID so we can easily find/remove it
		// if it is dismissible/has a timeout.
		const id = `${Date.now()}-${count++}`;

		const entry = { id, ...toast };

		toasts.update((all) => [entry, ...all]);
	};

	return {
		subscribe: toasts.subscribe,
		pop,
		push,
		clean
	};
};
