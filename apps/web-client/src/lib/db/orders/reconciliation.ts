import type { DB, reconciliationOrder } from "./types";

export async function getAllReconciliationOrders(db: DB): Promise<reconciliationOrder[]> {
	const result = await db.execO<reconciliationOrder>(
		"SELECT id, supplier_order_ids, customer_order_line_ids, created FROM reconciliation_order ORDER BY id ASC;"
	);
	return result;
}

export async function getReconciliationOrder(db: DB, id: number): Promise<reconciliationOrder> {
	const result = await db.execO<reconciliationOrder>(
		"SELECT id, supplier_order_ids, customer_order_line_ids, created FROM reconciliation_order WHERE id = ?;",
		[id]
	);
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

export async function updateReconciliationOrder(db: DB, id: number, customerOrderLineIds: string[]) {
	if (!id) {
		throw new Error("Reconciliation order must have an id");
	}

	const customer_order_line_ids = customerOrderLineIds.join(", ");
	await db.exec(`UPDATE reconciliation_order SET customer_order_line_ids = (?) WHERE id = ?;`, [customer_order_line_ids, id]);
}
