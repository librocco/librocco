import type { DB } from "./types";

export type PastNoteItem = {
	id: number;
	displayName: string;
	noteType: string;
	totalBooks: number;
	warehouseName: string;
	totalCoverPrice: number;
	totalDiscountedPrice: number;
};

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
