import type { ToastOptions, Toast as ToastCore } from "../Toasts";

export enum ToastType {
	Success = "success",
	Error = "error"
}

export type ToastData = ToastOptions<ToastType>;
export type Toast = ToastCore<ToastType>;
