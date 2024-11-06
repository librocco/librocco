import type { CreateDialogProps } from "@melt-ui/svelte";

export const defaultDialogConfig: CreateDialogProps = {
	forceVisible: false,
	preventScroll: true,
	closeOnOutsideClick: true,
	closeOnEscape: true,
};
