export type InventoryTableData = BookCoreRowData & BookOptionalRowData & BookWarehousesRowData;

export type BookCoreRowData = {
	isbn: string;
	title: string;
	price: number;
	authors?: string;
	quantity?: number;
	year?: number;
};

export type BookOptionalRowData = {
	publisher?: string;
	year?: string;
	editedBy?: string;
	outOfPrint?: boolean;
};

export type BookWarehousesRowData = {
	warehouses: string[];
};
