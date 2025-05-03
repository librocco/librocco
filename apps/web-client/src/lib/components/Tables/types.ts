import type { NoteCustomItem, NoteEntriesItem } from "$lib/db/types";
import type { VolumeStockKind } from "@librocco/shared";

/**
 * TODO: Temmp interface to be replaced with DB Customer/Supplier Order interface
 */
export interface OrderData {
	name: string;
	email: string;
	id: string;
	pending: boolean;
	lastUpdated: string;
	actionLink: string;
}

// TODO: add availableWarehouses
type InventoryTableDataBook = NoteEntriesItem & {
	__kind?: "book";
	availableWarehouses?: Map<number, { displayName: string; quantity: number }>;
};
type InventoryTableDataCustomItem = NoteCustomItem & {
	__kind: "custom";
};

export type InventoryTableData<K extends VolumeStockKind = VolumeStockKind> = K extends "book"
	? InventoryTableDataBook
	: InventoryTableDataCustomItem;

// TODO probably no longer necessary
export type BookCoreRowData = {
	isbn: string;
	title: string;
	price: number;
	quantity: number;
	warehouseId: number;
	warehouseName: string;
	warehouseDiscount: number;
	authors?: string;
	year?: string;
};
