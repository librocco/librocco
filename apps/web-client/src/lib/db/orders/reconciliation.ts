import type { DB, ReconciliationOrder } from "./types";

export async function getAllReconciliationOrders(db: DB): Promise<ReconciliationOrder[]> {
	const result = await db.execO<ReconciliationOrder>(
		"SELECT id, supplier_order_ids, customer_order_line_ids, created FROM reconciliation_order ORDER BY id ASC;"
	);
	return result;
}

export async function getReconciliationOrder(db: DB, id: number): Promise<ReconciliationOrder> {
	const result = await db.execO<ReconciliationOrder>(
		"SELECT id, supplier_order_ids, customer_order_line_ids, created FROM reconciliation_order WHERE id = ?;",
		[id]
	);
	if (!result.length) {
		throw new Error(`Reconciliation order with id ${id} not found`);
	}
	return result[0];
}

export async function createReconciliationOrder(db: DB, supplierOrderIds: string[]) {
	if (!supplierOrderIds.length) {
		throw new Error("Reconciliation order must be based on at least one supplier order");
	}

	const supplierOrderIdsJoined = supplierOrderIds.join(", ");

	const tt = await db.execA(`INSERT INTO reconciliation_order (supplier_order_ids) VALUES (?) RETURNING id;`, [supplierOrderIdsJoined]);
	return tt[0][0];
}
/**
 * The way I see it while the isbns are being scanned they'll be cached
 * and this function will be throttled and called with the cached isbns every given amount of time
 * or every given n of isbns
 * @param db
 * @param id
 * @param isbns: same as customer_order_line_ids
 */
export async function addOrderLinesToReconciliationOrder(db: DB, id: number, isbns: string[]) {
	const reconOrder = await db.execO<{ supplierOrderIds: string }>(
		"SELECT supplier_order_ids as supplierOrderIds FROM reconciliation_order WHERE id = ?;",
		[id.toString()]
	);

	if (!reconOrder[0]) {
		throw new Error(`Reconciliation order ${id} not found`);
	}
	const isbnString = isbns.join(", ");

	await db.exec(`UPDATE reconciliation_order SET customer_order_line_ids = (?) WHERE id = ?;`, [isbnString, id.toString()]);
}

export async function getMatchingSupplierOrderLineIds(db: DB, isbns: string[], supplierOrderIds: string): Promise<number[]> {
	const ids = supplierOrderIds.split(", ");
	if (!ids.length) {
		throw Error("No supplier orders are part of this reconciliation order");
	}

	// Convert supplier order IDs to strings for LIKE matching
	const likePatterns = ids.map((id) => `%${id}%`);

	// Build the dynamic query with the right number of parameters
	const isbnPlaceholders = isbns.map(() => "?").join(",");
	const likeClauses = likePatterns.map(() => "supplier_order_ids LIKE ?").join(" OR ");

	const query = `
         SELECT id
         FROM customer_order_lines
         WHERE isbn IN (${isbnPlaceholders})
         AND (${likeClauses})
     `;

	// Combine parameters in the correct order
	const params = [...isbns, ...likePatterns];

	const results = await db.execA(query, params);
	return results.map((row) => row[0]);
}

export async function finalizeReconciliationOrder(db: DB, id: number) {
	if (!id) {
		throw new Error("Reconciliation order must have an id");
	}

	// does it get deleted or finalize = true
	//
	// mark all customer orders as received
}
