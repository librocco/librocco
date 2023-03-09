export type InventoryTableData = {
	isbn: string;
	title: string;
	authors?: string;
	quantity?: number;
	price: number;
	publisher?: string;
	year?: string;
	editedBy?: string;
	outOfPrint?: boolean;
};
