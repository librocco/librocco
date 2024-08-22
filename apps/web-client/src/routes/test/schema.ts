export type Schema = {
	warehouses: {
		id: string;
		displayName: string;
		discountPercentage: string;
		createdAt: string;
		updatedAt: string;
	};

	notes: {
		id: string;
		warehouseId: string;
		noteType: string;
		committed: number;
		deleted: number;
		displayName: string;
		defaultWarehouse: string;
		reconciliationNote: number;
		createdAt: string;
		updatedAt: string;
		committedAt: string;
	};

	bookTransactions: {
		warehouseId: string;
		noteId: string;
		isbn: string;
		quantity: number;
		updatedAt: string;
	};

	customItemTransactions: {
		noteId: string;
		id: string;
		title: string;
		price: number;
		updatedAt: string;
	};

	bookData: {
		isbn: string;
		title: string;
		price: number;
		year: string;
		authors: string;
		publisher: string;
		editedBy: string;
		outOfPrint: number;
		category: string;
		updatedAt: string;
	};
};
