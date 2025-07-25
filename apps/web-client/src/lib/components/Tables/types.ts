import type { NoteCustomItem, NoteEntriesItem } from "$lib/db/cr-sqlite/types";
import type { VolumeStockKind } from "@librocco/shared";

type InventoryTableDataBook = NoteEntriesItem & {
	__kind?: "book";
	type?: string;
	availableWarehouses?: Map<number, { displayName: string; quantity: number }>;
};
type InventoryTableDataCustomItem = NoteCustomItem & {
	__kind: "custom";
};

export type InventoryTableData<K extends VolumeStockKind = VolumeStockKind> = K extends "book"
	? InventoryTableDataBook
	: InventoryTableDataCustomItem;
