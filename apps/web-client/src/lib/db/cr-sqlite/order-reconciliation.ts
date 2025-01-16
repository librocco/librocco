import { multiplyString } from "./customers";
import type { DB, ReconciliationOrder, ReconciliationOrderLine } from "./types";

export async function getAllReconciliationOrders(db: DB): Promise<ReconciliationOrder[]> {
	const result = await db.execO<ReconciliationOrder>(
		"SELECT id, supplier_order_ids, finalized, updatedAt, created FROM reconciliation_order ORDER BY id ASC;"
	);
	return result;
}

export async function getReconciliationOrder(db: DB, id: number): Promise<ReconciliationOrder> {
	const result = await db.execO<ReconciliationOrder>(
		`SELECT id, supplier_order_ids, finalized, updatedAt, created
		FROM reconciliation_order WHERE id = ?;`,
		[id]
	);

	if (!result.length) {
		throw new Error(`Reconciliation order with id ${id} not found`);
	}

	return result[0];
}
export async function getReconciliationOrderLines(db: DB, id: number): Promise<ReconciliationOrderLine[]> {
	const result = await db.execO<ReconciliationOrderLine>(
		`SELECT * FROM reconciliation_order_lines
		WHERE reconciliation_order_id = ?;`,
		[id]
	);

	return result;
}

export async function createReconciliationOrder(db: DB, supplierOrderIds: number[]): Promise<number> {
	if (!supplierOrderIds.length) {
		throw new Error("Reconciliation order must be based on at least one supplier order");
	}

	const recondOrder = await db.execO<{ id: number }>(
		`INSERT INTO reconciliation_order (supplier_order_ids) VALUES (json_array(${multiplyString(
			"?",
			supplierOrderIds.length
		)})) RETURNING id;`,
		supplierOrderIds
	);
	return recondOrder[0].id;
}

export async function addOrderLinesToReconciliationOrder(db: DB, id: number, isbns: string[]) {
	const reconOrder = await db.execO<ReconciliationOrder>("SELECT * FROM reconciliation_order WHERE id = ?;", [id]);

	if (!reconOrder[0]) {
		throw new Error(`Reconciliation order ${id} not found`);
	}

	const params = isbns.map((isbn) => [id, isbn]).flat();

	const sql = `
     INSERT INTO reconciliation_order_lines (reconciliation_order_id, isbn)
     VALUES ${multiplyString("(?,?)", isbns.length)};`;

	await db.exec(sql, params);
}

export async function finalizeReconciliationOrder(db: DB, id: number) {
	if (!id) {
		throw new Error("Reconciliation order must have an id");
	}

	const reconOrderLines = await db.execO<ReconciliationOrderLine>("SELECT * FROM reconciliation_order_lines WHERE id = ?;", [id]);

	const reconOrder = await db.execO<ReconciliationOrder>("SELECT finalized FROM reconciliation_order WHERE id = ?;", [id]);
	if (!reconOrder[0]) {
		throw new Error(`Reconciliation order ${id} not found`);
	}

	if (reconOrder[0].finalized) {
		throw new Error(`Reconciliation order ${id} is already finalized`);
	}

	let customerOrderLines: string[];
	try {
		customerOrderLines = reconOrderLines.map((line) => line.isbn);
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
