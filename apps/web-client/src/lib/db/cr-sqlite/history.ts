/**
 * @fileoverview Transaction History System
 *
 * History Overview:
 * - Provides historical views of committed notes and transactions
 * - Supports querying past notes by date
 * - Supports querying past transactions with flexible filters
 * - Calculates totals and pricing for historical analysis
 * - Only includes committed notes/transactions
 *
 * Data Sources:
 * - note table: Core note data and commit timestamps
 * - book_transaction table: Individual book movements
 * - book table: Book metadata and pricing
 * - warehouse table: Location names and discounts
 */

import type { DB, PastNoteItem, PastTransactionItem } from "./types";

/**
 * Retrieves all committed notes for a specific date.
 * Includes summary information like total books and pricing.
 * Groups transactions by note and calculates warehouse-specific discounts.
 *
 * @param {DB} db - Database connection
 * @param {string} date - Date to query in YYYY-MM-DD format
 * @returns {Promise<PastNoteItem[]>} Committed notes
 */
export function getPastNotes(db: DB, date: string): Promise<PastNoteItem[]> {
	const query = `
            SELECT
                n.id,
                n.display_name AS displayName,
                CASE
                    WHEN n.warehouse_id IS NOT NULL OR n.is_reconciliation_note = 1 THEN 'inbound'
                    ELSE 'outbound'
                END AS noteType,
                SUM(bt.quantity) AS totalBooks,
				CASE
                    WHEN n.warehouse_id IS NOT NULL OR n.is_reconciliation_note = 1 THEN w.display_name
                    ELSE 'Outbound'
				END AS warehouseName,
                SUM(bt.quantity * b.price) AS totalCoverPrice,
                SUM(bt.quantity * b.price * (1 - w.discount / 100.0)) AS totalDiscountedPrice
            FROM note n
            JOIN book_transaction bt ON n.id = bt.note_id
            JOIN book b ON bt.isbn = b.isbn
            LEFT JOIN warehouse w ON bt.warehouse_id = w.id
            WHERE DATE(n.committed_at / 1000, 'unixepoch') = ?
            GROUP BY n.id
            ORDER BY n.committed_at
        `;
	return db.execO(query, [date]);
}

/**
 * Parameters for filtering transaction history queries
 */
type Params = {
	isbn?: string;
	warehouseId?: number;
	startDate?: Date;
	endDate?: Date;
};

/**
 * Retrieves historical transactions with flexible filtering options.
 * Can filter by ISBN, warehouse, and date range.
 * Returns detailed information about each transaction including book metadata.
 * Only includes transactions from committed notes.
 *
 * @param {DB} db - Database connection
 * @param {Params} params - Query filters:
 *   - isbn: Filter by specific book
 *   - warehouseId: Filter by specific warehouse
 *   - startDate: Include transactions after this date
 *   - endDate: Include transactions before this date
 * @returns {Promise<PastTransactionItem[]>} Historical transactions with:
 *   - Basic info (isbn, title, author, quantity)
 *   - Pricing (price, discount)
 *   - Location (warehouseId, warehouseName)
 *   - Note details (noteId, noteName, noteType)
 *   - Timestamp (committedAt)
 */
export async function getPastTransactions(db: DB, params: Params): Promise<PastTransactionItem[]> {
	const { isbn, warehouseId, startDate, endDate } = params;
	const conditions = [];
	const values = [];

	if (isbn) {
		conditions.push("bt.isbn = ?");
		values.push(isbn);
	}
	if (warehouseId) {
		conditions.push("bt.warehouse_id = ?");
		values.push(warehouseId);
	}
	if (startDate) {
		conditions.push("n.committed_at >= ?");
		values.push(startDate.getTime());
	}
	if (endDate) {
		conditions.push("n.committed_at <= ?");
		values.push(endDate.getTime() + 24 * 60 * 60 * 1000 - 1);
	}

	const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

	type QueryResItem = Omit<PastTransactionItem, "committedAt"> & { committed_at: number };

	const query = `
        SELECT
            bt.isbn,
            b.title,
            b.authors AS author,
            bt.quantity,
            b.price,
            n.committed_at,
            bt.warehouse_id AS warehouseId,
            w.display_name AS warehouseName,
            w.discount,
            n.id AS noteId,
            n.display_name AS noteName,
            CASE
                WHEN n.warehouse_id IS NOT NULL OR n.is_reconciliation_note = 1 THEN 'inbound'
                ELSE 'outbound'
            END AS noteType
        FROM book_transaction bt
        JOIN note n ON bt.note_id = n.id
        JOIN book b ON bt.isbn = b.isbn
        LEFT JOIN warehouse w ON bt.warehouse_id = w.id
        ${whereClause}
        AND n.committed = 1
        ORDER BY n.committed_at
    `;

	const res = await db.execO<QueryResItem>(query, values);

	return res.map(({ committed_at, ...txn }) => ({ ...txn, committedAt: new Date(committed_at) }));
}
