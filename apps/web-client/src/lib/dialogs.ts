export interface DialogContent {
	onConfirm: (closeDialog: () => void) => void;
	title: string;
	description: string;
}

export const dialogTitle = {
	// Misc
	delete: (entity: string) => `Permenantly delete ${entity}?`,

	// Inbond
	commitInbound: (entity: string) => `Commit inbound ${entity}?`,

	// Outbound
	commitOutbound: (entity: string) => `Commit outbound ${entity}?`,
	noWarehouseSelected: () => "No warehouse(s) selected",
	reconcileOutbound: () => "Stock mismatch",

	// BookForm
	editBook: () => "Edit book details",
	createCustomItem: () => "Create custom item",
	editCustomItem: () => "Edit custom item",

	// WarehouseForm
	editWarehouse: () => "Update book details"
};

export const dialogDescription = {
	// Misc
	deleteNote: () => "Once you delete this note, you will not be able to access it again",
	deleteWarehouse: (bookCount: number) => `Once you delete this warehouse ${bookCount} books will be removed from your stock`,

	// Inbound
	commitInbound: (bookCount: number, warehouseName: string) => `${bookCount} books will be added to ${warehouseName}`,

	// Outbound
	commitOutbound: (bookCount: number) => `${bookCount} books will be removed from your stock`,
	noWarehouseSelected: () => "Can't commit the note as some transactions don't have any warehouse selected",
	reconcileOutbound: () =>
		"Some quantities reqested are greater than available in stock and will need to be reconciled in order to proceed.",

	// BookForm
	editBook: () => "Update book details",

	// WarehouseForm
	editWarehouse: () => "Update warehouse details"
};
