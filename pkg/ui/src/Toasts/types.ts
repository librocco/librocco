import type { createToasterStore } from "./toaster";
import type { createToastStore } from "./toast";

export type ToasterStore = ReturnType<typeof createToasterStore>;
export type ToastStore = ReturnType<ReturnType<typeof createToastStore>>;

export interface Toaster {
	toaster: ToasterStore;
}

// TODO: add `target` to send toasts to specific container
// includes better way to handle / pass around toasterId's, if Toast component requires it to `consume`

export interface ToastOptions<T = any> {
	message: string;
	duration: number;
	pausable: boolean;
	type: T;
}

export interface Toast<T = any> extends ToastOptions<T> {
	id: string;
}
