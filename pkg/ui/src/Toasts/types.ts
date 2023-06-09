import type { createToasterStore } from "./toaster";

export interface ToasterContext {
	toaster: ReturnType<typeof createToasterStore>;
}

export interface Toast {
	id: number;
	message: string;
	duration: number;
	pausable: boolean;
}
