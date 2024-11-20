import { multiplyString } from "./customers";
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

export async function createReconciliationOrder(db: DB, supplierOrderIds: number[]) {
	if (!supplierOrderIds.length) {
		throw new Error("Reconciliation order must be based on at least one supplier order");
	}

	console.log(supplierOrderIds);
	const recondOrder = await db.execA(
		`INSERT INTO reconciliation_order (supplier_order_ids) VALUES (json_array(${multiplyString(
			"?",
			supplierOrderIds.length
		)})) RETURNING id;`,
		supplierOrderIds
	);
	return recondOrder[0][0];
}

export async function addOrderLinesToReconciliationOrder(db: DB, id: number, isbns: string[]) {
	const reconOrder = await db.execO<{ supplierOrderIds: number[] }>(
		"SELECT supplier_order_ids as supplierOrderIds FROM reconciliation_order WHERE id = ?;",
		[id]
	);

	if (!reconOrder[0]) {
		throw new Error(`Reconciliation order ${id} not found`);
	}
	const isbnString = isbns.join(", ");

	await db.exec(`UPDATE reconciliation_order SET customer_order_line_ids = (?) WHERE id = ?;`, [isbnString, id.toString()]);
}

export async function finalizeReconciliationOrder(db: DB, id: number) {
	if (!id) {
		throw new Error("Reconciliation order must have an id");
	}
}
