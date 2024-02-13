export type InventoryTableData = BookCoreRowData & {
	publisher?: string;
	year?: string;
	editedBy?: string;
	outOfPrint?: boolean;
};

export type BookCoreRowData = {
	isbn: string;
	title: string;
	price: number;
	quantity: number;
	warehouseId: string;
	warehouseName: string;
	warehouseDiscount: number;
	authors?: string;
	year?: string;
};

// TODO: Align with DB types =>
// VolumeStockClient has warehouseName as a string, but it should expect an array where
// a volume in an Out Note can potentially come out of multiple warehouses
export type OutNoteTableData = BookCoreRowData & {
	/** @TODO this is a NavMap ... move shared types to 'shared' package */
	availableWarehouses?: Map<string, { displayName: string }>;
};
