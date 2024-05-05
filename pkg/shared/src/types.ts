export type VolumeStockKind = "book" | "custom";

/* eslint-disable @typescript-eslint/ban-types */
/**
 * A union of entries found in note and warehouse's `entries` (`"custom"` variant should only be found in outbond notes).
 * The union can be descriminated over the `__kind` property.
 */
export type VolumeStock<K extends VolumeStockKind = VolumeStockKind> = K extends "book"
	? {
			__kind?: "book";
			isbn: string;
			quantity: number;
			warehouseId: string;
	  }
	: {
			__kind: "custom";
			id: string;
			title: string;
			price: number;
	  };

/**
 * Input for VolumeStockMap, used to aggregate the transactions and calculate stock.
 *
 * _note: only valid inputs are book-related rows as custom rows are not used in stock calculations (used only as rows in particular notes)._
 */
export type VolumeStockInput = VolumeStock<"book"> & { noteType: "inbound" | "outbound" };

export type StockKey = [isbn: string, warehouseId: string];
export type StockElement = { quantity: number };
export type StockEntry = [StockKey, StockElement];
export type VolumeStockMap = Map<StockKey, StockElement>;
