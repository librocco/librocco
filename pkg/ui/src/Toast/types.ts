import type { ToastCore } from "../Toasts";

export enum ToastType {
	Success = "success",
	Error = "error"
}

export type Toast = ToastCore & {
	type: ToastType;
};
