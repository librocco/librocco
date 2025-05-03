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

import type { DB, GetStockResponseItem } from "./types";

import { timed } from "$lib/utils/timer";

/**
 * Parameters for filtering stock queries
 */
type GetStockParams = {
	searchString?: string;
	// If provided the results are filtered by provided (isbn, warehouseId) pairs
	entries?: { isbn: string; warehouseId: number }[];
	// If provided the results are filtered by provided isbn, providing stock for each isbn across different warehouses
	isbns?: string[];
	warehouseId?: number;
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
async function _getStock(
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
			COALESCE(b.year, 'N/A') AS year,
			COALESCE(b.authors, 'N/A') AS authors,
			COALESCE(b.publisher, '') AS publisher,
			COALESCE(b.edited_by, '') AS editedBy,
			b.out_of_print,
			COALESCE(b.category, '') AS category
		FROM book_transaction bt
		JOIN note n ON bt.note_id = n.id
		LEFT JOIN book b ON bt.isbn = b.isbn
		LEFT JOIN warehouse w ON bt.warehouse_id = w.id
		${whereClause}
		GROUP BY bt.isbn, bt.warehouse_id
		HAVING SUM(CASE WHEN n.warehouse_id IS NOT NULL OR n.is_reconciliation_note = 1 THEN bt.quantity ELSE -bt.quantity END) != 0
		ORDER BY bt.isbn, bt.warehouse_id
	`;

	const res = await db.execO<Omit<GetStockResponseItem, "outOfPrint"> & { out_of_print: number }>(query, filterValues);
	return res.map(({ out_of_print, ...rest }) => ({ outOfPrint: !!out_of_print, ...rest }));
}
export const getStock = timed(_getStock);
