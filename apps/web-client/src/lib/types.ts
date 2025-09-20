export interface DialogContent {
	onConfirm: (closeDialog: () => void) => void;
	title: string;
	description: string;
}

export type ProgressState = {
	active: boolean;
	nProcessed: number;
	nTotal: number;
};
