import type { createToasterStore } from "./toaster";

export interface ToasterContext {
	toaster: ReturnType<typeof createToasterStore>;
}

// TODO: add `target` to send toasts to specific container
// includes better way to handle / pass around toasterId's, if Toast component requires it to `consume`

export interface Toast {
	id: number;
	message: string;
	duration: number;
	pausable: boolean;
}
