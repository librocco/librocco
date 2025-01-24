/**
 * @fileoverview Warehouse management system
 *
 * Warehouse Overview:
 * - A warehouse represents a logical grouping of books based on categories or attributes
 * - Examples: "New Books", "Used Books", "2025 School Year", "Computer Science", etc.
 * - Each warehouse can have a display name and an optional discount that applies to all of its books
 * - Books are moved in to or out of warehouses via "notes" - these are transactions that increase/decrease a batch of isbn-quantities
 * - Book counts are maintained through a running total of these transactions
 * - Warehouses are created with auto-incrementing display names (e.g., "New Warehouse", "New Warehouse (2)")
 *
 * Data Sources:
 * - warehouse table:
 * - note table: Contains metadata about transactions
 * - book_transaction table: Records book "line-item" movements
 */

import type { PickPartial } from "@librocco/db";
import type { DB, TXAsync, Warehouse } from "./types";

/**
 * Generates the next sequential warehouse display name.
 * If no warehouses exist, returns "New Warehouse".
 * If "New Warehouse" exists, returns "New Warehouse (2)".
 * Otherwise returns "New Warehouse (n+1)" where n is the highest existing sequence number.
 *
 * @param {DB | TXAsync} db - Database connection
 * @returns {Promise<string>} The next sequential warehouse name
 */
const getSeqName = async (db: DB | TXAsync) => {
	const sequenceQuery = `
			SELECT display_name AS displayName FROM warehouse
			WHERE displayName LIKE 'New Warehouse%'
			ORDER BY displayName DESC
			LIMIT 1;
		`;
	const result = await db.execO<{ displayName?: string }>(sequenceQuery);
	const displayName = result[0]?.displayName;

	if (!displayName) {
		return "New Warehouse";
	}

	if (displayName === "New Warehouse") {
		return "New Warehouse (2)";
	}

	const maxSequence = Number(displayName.replace("New Warehouse", "").replace("(", "").replace(")", "").trim()) + 1;

	return `New Warehouse (${maxSequence})`;
};

/**
 * Creates a new warehouse or updates an existing one.
 * If no display name is provided, generates one using getSeqName().
 * Updates are performed as a single transaction.
 *
 * @param {DB} db - Database connection
 * @param {PickPartial<Warehouse, "displayName" | "discount">} data - Warehouse data with required id
 * @throws {Error} If warehouse id is not provided
 * @returns {Promise<void>} Resolves when upsert completes
 */
export function upsertWarehouse(db: DB, data: PickPartial<Warehouse, "displayName" | "discount">): Promise<void> {
	if (!data.id) {
		throw new Error("Warehouse must have an id");
	}

	const _data = { ...data };

	return db.tx(async (txDb) => {
		_data.displayName = data.displayName || (await getSeqName(txDb));

		const keys = Object.keys(_data).map((x) => (x === "displayName" ? "display_name" : x));
		const values = Object.values(_data);

		const query = `
        INSERT INTO warehouse (${keys.join(",")})
        VALUES (${keys.map(() => "?").join(",")})
        ON CONFLICT(id) DO UPDATE SET
            display_name = COALESCE(?, display_name),
            discount = COALESCE(?, discount);
    `;
		await txDb.exec(query, [...values, data.displayName, _data.discount ?? null]);
	});
}

/**
 * Retrieves all warehouses with their total book counts.
 * Book counts are calculated from book transactions, considering:
 * - Positive quantities for inbound and reconciliation notes
 * - Negative quantities for outbound notes
 * Only committed notes are included in calculations.
 *
 * @param {DB} db - Database connection
 * @returns {Promise<(Warehouse & { totalBooks: number })[]>} Warehouses with book counts
 */
export async function getAllWarehouses(db: DB): Promise<(Warehouse & { totalBooks: number })[]> {
	// NOTE: there's a n.committed IS NULL constraint
	// - this makes sure there are no issues if warehouse doesn't have any notes associated with it
	// - we make sure committed = 0 (default) and is never null to avoid miscalculations here
	//   ^ the tests thouroughly test this
	const query = `
		SELECT
			w.id,
			w.display_name AS displayName,
			w.discount,
			COALESCE(SUM(CASE WHEN n.warehouse_id IS NOT NULL OR n.is_reconciliation_note = 1 THEN bt.quantity ELSE -bt.quantity END), 0) AS totalBooks
		FROM warehouse w
		LEFT JOIN book_transaction bt ON w.id = bt.warehouse_id
		LEFT JOIN note n ON bt.note_id = n.id
		WHERE n.committed = 1 OR n.committed IS NULL
		GROUP BY w.id
	`;
	return db.execO<Warehouse & { totalBooks: number }>(query);
}
