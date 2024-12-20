import type { DB } from "./types";

type GetStockParams = {
	searchString?: string;
};

type GetStockResponseItem = {
	isbn: string;
	quantity: number;
	warehouseId?: number;
	warehouseName?: number;
	title?: string;
	price?: number;
	year?: string;
	authors?: string;
	publisher?: string;
	editedBy?: string;
	outOfPrint?: boolean;
	category?: string;
};

export async function getStock(db: DB, { searchString = "" }: GetStockParams = {}): Promise<GetStockResponseItem[]> {
	const query = `
		SELECT
			bt.isbn,
			SUM(CASE WHEN n.warehouse_id IS NOT NULL OR n.is_reconciliation_note = 1 THEN bt.quantity ELSE -bt.quantity END) AS quantity,
			bt.warehouse_id AS warehouseId,
			w.display_name AS warehouseName,
			b.title,
			b.price,
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
		WHERE n.committed = 1
		${searchString ? `AND (bt.isbn LIKE ? OR b.title LIKE ? OR b.authors LIKE ?)` : ""}
		GROUP BY bt.isbn, bt.warehouse_id
		HAVING SUM(CASE WHEN n.warehouse_id IS NOT NULL OR n.is_reconciliation_note = 1 THEN bt.quantity ELSE -bt.quantity END) != 0
		ORDER BY bt.isbn, bt.warehouse_id
	`;

	const params = searchString ? [`%${searchString}%`, `%${searchString}%`, `%${searchString}%`] : [];
	return db.execO<GetStockResponseItem>(query, params);
}
