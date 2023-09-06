import type { ToastOptions, ToastEntry } from "../Toasts";

export enum ToastType {
	Success = "success",
	Error = "error",
	Warning = "warning"
}

export type ToastData = ToastOptions<ToastType>;
export type Toast = ToastEntry<ToastType>;
