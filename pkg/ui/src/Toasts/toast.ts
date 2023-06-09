import { writable, derived } from "svelte/store";
import { getContext } from "svelte";

import { tweened } from "svelte/motion";
import { linear } from "svelte/easing";

import type { ToasterContext } from "./types";

/**
 * Sets up toast store and action
 */
export const consume = (_toast, target = "default") => {
	const { toaster: toasterStore } = getContext<ToasterContext>(target);

	// TODO: no toaster context found...

	const toastStore = createToastStore(toasterStore)(_toast);

	const toastAction = createToastAction(toastStore);

	return {
		...toastStore,
		toast: toastAction
	};
};

/**
 * Creates a toast store to hold and manage toast data
 */
export const createToastStore = (toasterStore) => (_toast) => {
	const toastStore = writable(_toast);
	const progressStore = tweened(0, { duration: _toast.duration, easing: linear });

	const toast = derived([toastStore, progressStore], ([$toastStore, $progressStore]) => {
		return {
			...$toastStore,
			progress: $progressStore
		};
	});

	return {
		...toast,
		close: () => {
			toasterStore.pop(_toast.id);
		},
		setProgress: progressStore.set
	};
};

/**
 * Creates a toast action which will initialise the toast progress
 */
export const createToastAction = (toastStore) => (node) => {
	const next = 1;

	toastStore.setProgress(next);
	node.setAttribute("role", "alert");

	let toast;
	const unsubscribe = toastStore.subscribe((t) => {
		toast = t;

		if (toast.progress === 1) {
			toastStore.close();
		}
	});

	return {
		destroy() {
			unsubscribe();
		}
	};
};
