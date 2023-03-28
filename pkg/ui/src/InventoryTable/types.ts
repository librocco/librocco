export type InventoryTableData = BookCoreRowData & {
	publisher?: string;
	year?: string;
	editedBy?: string;
	outOfPrint?: boolean;
};

// TODO: Align with DB types =>
// VolumeStockClient has warehouseName as a string, but it should expect an array where
// a volume in an Out Note can potentially come out of multiple warehouses
export type OutNoteTableData = BookCoreRowData & {
	warehouseId: string;
	warehouseName: string;
	availableWarehouses?: { value: string; label: string }[];
};

export type BookCoreRowData = {
	isbn: string;
	title: string;
	price: number;
	quantity: number;
	authors?: string;
	year?: string;
};

export type WarehouseChangeDetail = {
	warehouseId: string;
};

export type TransactionUpdateDetail = {
	matchTxn: { isbn: string; warehouseId?: string; quantity: number };
	updateTxn: { isbn: string; warehouseId?: string; quantity: number };
};
