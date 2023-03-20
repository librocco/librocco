export type InventoryTableData = BookCoreRowData & {
	publisher?: string;
	year?: string;
	editedBy?: string;
	outOfPrint?: boolean;
};

export type OutNoteTableData = BookCoreRowData & {
	warehouses: string[];
};

export type BookCoreRowData = {
	isbn: string;
	title: string;
	price: number;
	authors?: string;
	quantity?: number;
	year?: string;
};
