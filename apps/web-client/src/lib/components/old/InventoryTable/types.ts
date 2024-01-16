export type RemoveTransactionsDetail = { isbn: string; warehouseId: string }[];

export type TransactionUpdateDetail = {
	matchTxn: { isbn: string; warehouseId?: string; quantity: number };
	updateTxn: { isbn: string; warehouseId?: string; quantity: number };
};
