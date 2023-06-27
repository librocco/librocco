/** An interface representing the way book quantity is stored in the db, be it transaction (notes) or stock (warehouse/all stock) */
export interface VolumeStockInput {
	isbn: string;
	quantity: number;
	warehouseId: string;
	noteType: "inbound" | "outbound";
}
