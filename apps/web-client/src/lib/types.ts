export interface DialogContent {
	onConfirm: (closeDialog: () => void) => void;
	title: string;
	description: string;
}
