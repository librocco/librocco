import { multiplyString } from "./customers";
import type { DB, ReconciliationOrder } from "./types";

export async function getAllReconciliationOrders(db: DB): Promise<ReconciliationOrder[]> {
	const result = await db.execO<ReconciliationOrder>(
		"SELECT id, supplier_order_ids, finalized, customer_order_line_ids, created FROM reconciliation_order ORDER BY id ASC;"
	);
	return result;
}

export async function getReconciliationOrder(db: DB, id: number): Promise<ReconciliationOrder> {
	const result = await db.execO<ReconciliationOrder>(
		"SELECT id, supplier_order_ids, finalized, customer_order_line_ids, created FROM reconciliation_order WHERE id = ?;",
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

	await db.exec(
		`UPDATE reconciliation_order SET customer_order_line_ids = (json_array(${multiplyString("?", isbns.length)})) WHERE id = ?;`,
		[...isbns, id]
	);
}
export async function finalizeReconciliationOrder(db: DB, id: number) {
	if (!id) {
		throw new Error("Reconciliation order must have an id");
	}

	const reconOrder = await db.execO<{
		isbns: string;
		finalized: number;
	}>("SELECT customer_order_line_ids as isbns, finalized FROM reconciliation_order WHERE id = ?;", [id]);
	if (!reconOrder[0]) {
		throw new Error(`Reconciliation order ${id} not found`);
	}

	if (reconOrder[0].finalized) {
		throw new Error(`Reconciliation order ${id} is already finalized`);
	}

	let customerOrderLines: string[];
	try {
		customerOrderLines = reconOrder[0].isbns ? JSON.parse(reconOrder[0].isbns) : [];
	} catch (e) {
		throw new Error(`Invalid customer order lines format in reconciliation order ${id}`);
	}
	return db.tx(async (txDb) => {
		await txDb.exec(`UPDATE reconciliation_order SET finalized = 1 WHERE id = ?;`, [id]);

		const placeholders = multiplyString("?", customerOrderLines.length);

		if (customerOrderLines.length > 0) {
			await txDb.exec(
				`
			 UPDATE customer_order_lines
            SET received = (strftime('%s', 'now') * 1000)
            WHERE rowid IN (
                SELECT MIN(rowid)
                FROM customer_order_lines
                WHERE isbn IN (${placeholders})
                    AND placed IS NOT NULL
                    AND received IS NULL
                GROUP BY isbn
);`,
				customerOrderLines
			);
		}
	});
}
