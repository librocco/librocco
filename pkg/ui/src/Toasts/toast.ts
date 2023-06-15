import { writable, derived } from "svelte/store";

import { tweened } from "svelte/motion";
import { linear } from "svelte/easing";

import { toasters } from "./toaster";

// TODO: what if toast shouldn't disappear automatically?

/**
 * Sets up toast store and action
 */
export const consume = (_toast, target = "default") => {
	const { toaster: toasterStore } = toasters.get(target);

	// TODO: no toaster found in map...

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

	let toast;
	let prev = next;
	let paused = false;

	node.setAttribute("role", "alert");
	toastStore.setProgress(next);

	const unsubscribe = toastStore.subscribe((t) => {
		toast = t;
		prev = t.progress;

		if (toast.progress === 1) {
			try {
				toastStore.close();
			} catch (e) {
				console.log(e);
			}
		}
	});

	// `pause` and `resume` are borrowed from
	// https://github.com/zerodevx/svelte-toast/blob/7bc9d10d5597624c391aa5893cca6311cd9551d5/src/lib/ToastItem.svelte#L28
	// TODO: tests only currently cover that they call setProgress, not what they should do
	const pause = () => {
		if (!paused && toast.progress !== next) {
			toastStore.setProgress(toast.progress, { duration: 0 });
			paused = true;
		}
	};

	const resume = () => {
		if (paused) {
			const d = toast.duration;
			const duration = d - d * ((toast.progress - prev) / (next - prev));

			toastStore.setProgress(next, { duration });
			paused = false;
		}
	};

	if (toast.pausable) {
		node.addEventListener("mouseenter", pause);
		node.addEventListener("mouseleave", resume);
	}

	return {
		destroy() {
			if (toast.pausable) {
				node.removeEventListener("mouseenter", pause);
				node.removeEventListener("mouseleave", resume);
			}

			unsubscribe();
		}
	};
};
