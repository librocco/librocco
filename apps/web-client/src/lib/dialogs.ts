export interface DialogContent {
	onConfirm: () => void;
	title: string;
	description: string;
}

export const dialogTitle = {
	delete: (entity: string) => `Permenantly delete ${entity}?`,
	confirm: (entity: string) => `Commit ${entity}?`,
	editBook: () => "Edit book details"
};

export const dialogDescription = {
	deleteNote: () => "Once you delete this note, you will not be able to access it again",
	deleteWarehouse: (bookCount: number) => `Once you delete this warehouse ${bookCount} books will be removed from your stock`,
	commitNote: (bookCount: number, warehouseName: string) => `${bookCount} books will be added to ${warehouseName}`,
	editBook: () => "Manually edit book details"
};
