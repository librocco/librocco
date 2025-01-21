import { multiplyString } from "./customers";
import type { DB, ReconciliationOrder, ReconciliationOrderLine } from "./types";

/**
 * Retrieves all reconciliation orders from the database, ordered by ID
ascending
 * @param db
 * @returns ReconciliationOrder array
 */
export async function getAllReconciliationOrders(db: DB): Promise<ReconciliationOrder[]> {
	const result = await db.execO<ReconciliationOrder>(
		"SELECT id, supplier_order_ids, finalized, updatedAt, created FROM reconciliation_order ORDER BY id ASC;"
	);
	return result;
}

/**
 * Retrieves a specific reconciliation order by ID
 * @param db
 * @param id - The ID of the reconciliation order to retrieve
 * @throws Error if order not found or if supplier_order_ids contains invalid
JSON
 * @returns ReconciliationOrder with parsed supplier_order_ids
 */
export async function getReconciliationOrder(db: DB, id: number): Promise<ReconciliationOrder & { supplierOrderIds: number[] }> {
	const result = await db.execO<ReconciliationOrder>(
		`SELECT id, supplier_order_ids, finalized, updatedAt, created
		FROM reconciliation_order WHERE id = ?;`,
		[id]
	);

	if (!result.length) {
		throw new Error(`Reconciliation order with id ${id} not found`);
	}

	try {
		JSON.parse(result[0].supplier_order_ids);
	} catch (e) {
		throw new Error(`Invalid json: supplier order ids`);
	}

	const res = { ...result[0], supplierOrderIds: JSON.parse(result[0].supplier_order_ids) };
	return res;
}

/**
 * Retrieves all order lines associated with a specific reconciliation order
 * @param db
 * @param id - The ID of the reconciliation order
 * @returns array of ReconciliationOrderLine objects with book details
 */
export async function getReconciliationOrderLines(db: DB, id: number): Promise<ReconciliationOrderLine[]> {
	const result = await db.execO<ReconciliationOrderLine>(
		`SELECT rol.isbn, rol.quantity, rol.reconciliation_order_id, book.publisher, book.authors, book.title, book.price FROM reconciliation_order_lines as rol
		LEFT JOIN book ON rol.isbn = book.isbn
		WHERE reconciliation_order_id = ?;`,
		[id]
	);

	return result;
}
/**
 * Creates a new reconciliation order based on existing supplier orders
 * @param db
 * @param supplierOrderIds - Array of su pplier order IDs to reconcile
 * @throws Error if supplierOrderIds array is empty
 * @returns ID of the newly created reconciliation order
 */
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

/**
 * Adds or updates order lines to an existing reconciliation order
 * @param db
 * @param id - The ID of the reconciliation order
 * @param newLines - Array of objects containing ISBN and quantity to add/update
 * @throws Error if reconciliation order not found
 */
export async function addOrderLinesToReconciliationOrder(db: DB, id: number, newLines: { isbn: string; quantity: number }[]) {
	const reconOrder = await db.execO<ReconciliationOrder>("SELECT * FROM reconciliation_order WHERE id = ?;", [id]);

	if (!reconOrder[0]) {
		throw new Error(`Reconciliation order ${id} not found`);
	}

	const params = newLines.map(({ isbn, quantity }) => [id, isbn, quantity]).flat();

	const sql = `
     INSERT INTO reconciliation_order_lines (reconciliation_order_id, isbn,
 quantity)
     VALUES ${multiplyString("(?,?,?)", newLines.length)}
     ON CONFLICT(reconciliation_order_id, isbn) DO UPDATE SET
         quantity = quantity + excluded.quantity;
     `;
	await db.exec(sql, params);
}
/**
  * Finalizes a reconciliation order and updates corresponding customer order
 lines
  * @param db
  * @param id - The ID of the reconciliation order to finalize
  * @throws Error if:
  * - ID is 0 or undefined
  * - Reconciliation order not found
  * - Order is already finalized
  * - Customer order lines format is invalid
  */
export async function finalizeReconciliationOrder(db: DB, id: number) {
	if (!id) {
		throw new Error("Reconciliation order must have an id");
	}

	const reconOrderLines = await db.execO<ReconciliationOrderLine>(
		"SELECT * FROM reconciliation_order_lines WHERE reconciliation_order_id = ?;",
		[id]
	);

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
