/**
 * @fileoverview Stock management system
 *
 * Stock Overview:
 * - Tracks current book quantities across all warehouses
 * - Stock levels are calculated from committed note transactions
 * - For inbound notes and reconciliation notes: quantities are added
 * - For outbound notes: quantities are subtracted
 * - Stock can be filtered by ISBN/warehouse pairs or search string
 * - Includes book metadata (title, price, etc) in stock queries
 * - Only considers committed notes when calculating quantities
 * - Returns zero or positive quantities only (negative stock is prevented)
 *
 * Data Sources:
 * - book_transaction table: Records individual book movements
 * - note table: Contains transaction metadata (committed status)
 * - warehouse table: Contains warehouse information
 * - book table: Contains book metadata
 */

import type { DB } from "./types";

/**
 * Parameters for filtering stock queries
 */
type GetStockParams = {
	searchString?: string;
	// If provided the results are filtered by provided (isbn, warehouseId) pairs
	entries?: { isbn: string; warehouseId: number }[];
};

type GetStockResponseItem = {
	isbn: string;
	quantity: number;
	warehouseId?: number;
	warehouseName?: string;
	title?: string;
	price?: number;
	year?: string;
	authors?: string;
	publisher?: string;
	editedBy?: string;
	outOfPrint?: boolean;
	category?: string;
};

/**
 * Retrieves current stock levels for books across all warehouses.
 * Calculates quantities based on committed note transactions.
 * Can filter results by search string or specific ISBN/warehouse pairs.
 * Only returns entries with non-zero quantities.
 *
 * @param {DB} db - Database connection
 * @param {GetStockParams} params - Query filters
 * @param {string} [params.searchString=""] - Filter by ISBN, title, or author
 * @param {Array<{isbn: string, warehouseId: number}>} [params.entries=[]] - Specific ISBN/warehouse pairs to query
 * @returns {Promise<GetStockResponseItem[]>} Current stock levels with book details:
 *   - isbn: Book identifier
 *   - quantity: Current stock level
 *   - warehouseId: Location of stock
 *   - warehouseName: Human readable warehouse name
 *   - Book metadata: title, price, year, authors, etc
 */
export async function getStock(db: DB, { searchString = "", entries = [] }: GetStockParams = {}): Promise<GetStockResponseItem[]> {
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
		${entries.length ? `AND (bt.isbn, bt.warehouse_id) IN (${entries.map(() => "(?, ?)").join(", ")})` : ""}
		GROUP BY bt.isbn, bt.warehouse_id
		HAVING SUM(CASE WHEN n.warehouse_id IS NOT NULL OR n.is_reconciliation_note = 1 THEN bt.quantity ELSE -bt.quantity END) != 0
		ORDER BY bt.isbn, bt.warehouse_id
	`;

	const params = [
		...(searchString ? [`%${searchString}%`, `%${searchString}%`, `%${searchString}%`] : []),
		...(entries ? entries.flatMap(({ isbn, warehouseId }) => [isbn, warehouseId]) : [])
	];
	return db.execO<GetStockResponseItem>(query, params);
}
