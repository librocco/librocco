import type { Toast as CoreToast } from "../Toasts/index";

export enum ToastType {
	Success = "success",
	Error = "error"
}

export type Toast = CoreToast & {
	type: ToastType;
};
