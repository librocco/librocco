import type { DB } from "./types";

type GetStockParams = {
	searchString?: string;
	// If provided the results are filtered by provided (isbn, warehouseId) pairs
	entries?: { isbn: string; warehouseId: number }[];
	// If provided the results are filtered by provided isbn, providing stock for each isbn across different warehouses
	isbns?: string[];
	warehouseId?: number;
};

type GetStockResponseItem = {
	isbn: string;
	quantity: number;
	warehouseId: number;
	warehouseName: string;
	warehouseDiscount: number;
	title: string;
	price: number;
	year?: string;
	authors?: string;
	publisher?: string;
	editedBy?: string;
	outOfPrint?: boolean;
	category?: string;
};

export async function getStock(
	db: DB,
	{ searchString = "", entries = [], isbns = [], warehouseId }: GetStockParams = {}
): Promise<GetStockResponseItem[]> {
	const filterClauses = [];
	const filterValues = [];

	if (searchString) {
		filterClauses.push(`(bt.isbn LIKE ? OR b.title LIKE ? OR b.authors LIKE ?)`);
		filterValues.push(`%${searchString}%`, `%${searchString}%`, `%${searchString}%`); // One value for each ?
	}

	if (entries?.length) {
		filterClauses.push(`(bt.isbn, bt.warehouse_id) IN (${entries.map(() => "(?, ?)").join(", ")})`);
		filterValues.push(...entries.flatMap(({ isbn, warehouseId }) => [isbn, warehouseId]));
	}

	if (isbns?.length) {
		filterClauses.push(`bt.isbn IN (${isbns.map(() => "?").join(", ")})`);
		filterValues.push(...isbns);
	}

	if (warehouseId) {
		filterClauses.push(`bt.warehouse_id = ?`);
		filterValues.push(warehouseId);
	}

	const whereClause = ["WHERE n.committed = 1", ...filterClauses].join(" AND ");

	const query = `
		SELECT
			bt.isbn,
			SUM(CASE WHEN n.warehouse_id IS NOT NULL OR n.is_reconciliation_note = 1 THEN bt.quantity ELSE -bt.quantity END) AS quantity,
			bt.warehouse_id AS warehouseId,
			COALESCE(w.display_name, w.id) AS warehouseName,
			COALESCE(w.discount, 0) AS warehouseDiscount,
			COALESCE(b.title, 'N/A') AS title,
			COALESCE(b.price, 0) AS price,
			b.year,
			b.authors,
			b.publisher,
			b.edited_by AS editedBy,
			b.out_of_print AS outOfPrint,
			b.category
		FROM book_transaction bt
		JOIN note n ON bt.note_id = n.id
		LEFT JOIN book b ON bt.isbn = b.isbn
		LEFT JOIN warehouse w ON bt.warehouse_id = w.id
		${whereClause}
		GROUP BY bt.isbn, bt.warehouse_id
		HAVING SUM(CASE WHEN n.warehouse_id IS NOT NULL OR n.is_reconciliation_note = 1 THEN bt.quantity ELSE -bt.quantity END) != 0
		ORDER BY bt.isbn, bt.warehouse_id
	`;

	return db.execO<GetStockResponseItem>(query, filterValues);
}
