import type { CreateDialogProps } from "@melt-ui/svelte";

export const defaultDialogConfig: CreateDialogProps = {
	escapeBehavior: "close",
	forceVisible: false,
	preventScroll: true,
	closeOnOutsideClick: true
};
