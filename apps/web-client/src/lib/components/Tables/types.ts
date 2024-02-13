/**
 * TODO: Temmp interface to be replaced with DB Customer/Supplier Order interface
 */
export interface OrderData {
	name: string;
	email: string;
	id: string;
	draft: boolean;
	lastUpdated: string;
	actionLink: string;
}

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

export type WarehouseChangeDetail = {
	warehouseId: string;
};

// TODO: Align with DB types =>
// VolumeStockClient has warehouseName as a string, but it should expect an array where
// a volume in an Out Note can potentially come out of multiple warehouses
export type OutNoteTableData = BookCoreRowData & {
	/** @TODO this is a NavMap ... move shared types to 'shared' package */
	availableWarehouses?: Map<string, { displayName: string }>;
};
