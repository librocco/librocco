import type { VolumeStockClient } from "@librocco/db";
import type { VolumeStockKind } from "@librocco/shared";

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

export type InventoryTableData<K extends VolumeStockKind = VolumeStockKind> = K extends "book"
	? BookCoreRowData & {
			publisher?: string;
			year?: string;
			editedBy?: string;
			outOfPrint?: boolean;
			category?: string;
		} & { availableWarehouses?: Map<string, { displayName: string; quantity: number }> }
	: VolumeStockClient<K>;

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
