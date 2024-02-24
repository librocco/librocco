/* eslint-disable @typescript-eslint/ban-types */
export interface VolumeStock {
	isbn: string;
	quantity: number;
	warehouseId: string;
}

export type VolumeStockInput = VolumeStock & { noteType: "inbound" | "outbound" };

export type StockKey = [isbn: string, warehouseId: string];
export type StockElement = { quantity: number };
export type StockEntry = [StockKey, StockElement];
export type VolumeStockMap = Map<StockKey, StockElement>;
