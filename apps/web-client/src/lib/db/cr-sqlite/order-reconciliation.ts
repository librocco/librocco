import type { BookEntry } from "@librocco/db";
import { multiplyString } from "./customers";
import type {
	DB,
	ProcessedOrderLine,
	ReconciliationOrder,
	ReconciliationOrderLine,
	PlacedSupplierOrder,
	PlacedSupplierOrderLine,
	DBReconciliationOrder
} from "./types";

/**
 * @fileoverview Supplier order reconciliation system
 *
 * Reconciliation overview:
 * - The reconciliation process begins when "placed" supplier orders are received
 * - The intention is to compare the isbns and quantities of delivered books against those that were ordered
 * - An employee starts a reconciliation process ("order") by selecting one or more supplier orders
 * - These can be from the same supplier or from different ones => we work with a list of "ordered lines" (`supplier_order_lines`)
 * - At the start of the process, a `reconciliation_order` is created. This tracks the selected `supplier_order` ids, as well as created, updatedAt, & finalized meta
 * - The process involves 3 steps:
 * - - scan/add delivered books
 * - - compare the delivered lines against the ordered
 * - - finalise the process
 * - Delivered lines are managed in a separate table `reconciliation_order_lines`. This is consistent with how supplier and customer order lines are managed.
 * - The comparison needs to check 3 cases:
 * - - "unmatched" isbns - delivered or accidentally scanned books that were never ordered
 * - - over delivered isbns
 * - - under delivered isbns
 * - The finalisation step should
 * - - update the status of the "oldest" customer order line for a given isbn.
 * - - It does not need to do anything with unmatched, or over delivered books. The employee should just be made aware of these anomalies.
 * * - Un- or under delivered isbns should re-enter the working/"possible" order batch for a supplier. Do we need to do anything else here?
 * - It should be possible for multiple people to work on the scan/add step of an in progress reconciliation at the same time
 * - It should not be possible to work on a reconciliation order once it has been finalised.
 *
 * Data Sources:
 * - The `reconciliation_order` table contains meta data about an in progress reconciliation order: related supplier_order ids, created, updatedAt, finalised (boolean)
 * - The `reconciliation_order_lines` table contains the book data lines for a scanned _delivered_ books
 */

/**
 * Retrieves all reconciliation orders from the database, ordered by ID
ascending
 * @param db
 * @param finalized - an optional boolean that's used to query finalized or non finalized orders
 * if not provided, all orders are fetched
 * @returns ReconciliationOrder array
 */
export async function getAllReconciliationOrders(db: DB, finalized?: boolean): Promise<ReconciliationOrder[]> {
	const result = await db.execO<DBReconciliationOrder>(
		`SELECT id, supplier_order_ids, finalized, updatedAt, created FROM reconciliation_order
		${finalized !== undefined && `WHERE finalized = ${finalized ? 1 : 0}`}
			ORDER BY id ASC;`
	);
	return result.map(unmarshalReconciliationOrder);
}

const unmarshalReconciliationOrder = ({ supplier_order_ids, created, updatedAt, ...order }: DBReconciliationOrder): ReconciliationOrder => {
	let supplierOrderIds = [];

	try {
		supplierOrderIds = JSON.parse(supplier_order_ids);
	} catch {
		const msg = [`Reconciliation order, id: ${order.id}: invalid json:`, `	supplier_order_ids: ${supplier_order_ids}`].join("\n");
		throw new Error(msg);
	}

	return { ...order, supplierOrderIds, created: new Date(created), updatedAt: new Date(updatedAt) };
};

/**
 * Retrieves a specific reconciliation order by ID
 * @param db
 * @param id - The ID of the reconciliation order to retrieve
 * @throws Error if order not found or if supplier_order_ids contains invalid
JSON
 * @returns ReconciliationOrder with parsed supplier_order_ids
 */
export async function getReconciliationOrder(db: DB, id: number): Promise<ReconciliationOrder & { supplierOrderIds: number[] }> {
	const [result] = await db.execO<DBReconciliationOrder>(
		`SELECT id, supplier_order_ids, finalized, updatedAt, created
		FROM reconciliation_order WHERE id = ?;`,
		[id]
	);

	if (!result) {
		throw new Error(`Reconciliation order with id ${id} not found`);
	}

	return unmarshalReconciliationOrder(result);
}

/**
 * Retrieves all order lines associated with a specific reconciliation order.
 * These are the _delivered_ books that an employee will add by scanning their isbns.
 *
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
 * Creates a new reconciliation order.
 * The array of supplier_order ids will be used to get the _ordered_ `supplier_order_lines` which the
 * delivered books will be compared against
 *
 * @param db
 * @param supplierOrderIds - Array of su pplier order IDs to reconcile
 * @throws Error if supplierOrderIds array is empty
 * @returns ID of the newly created reconciliation order
 * @see apps/e2e/helpers/cr-sqlite.ts:createReconciliationOrder
 */
export async function createReconciliationOrder(db: DB, supplierOrderIds: number[]): Promise<number> {
	if (!supplierOrderIds.length) {
		throw new Error("Reconciliation order must be based on at least one supplier order");
	}

	const timestamp = Date.now();

	const recondOrder = await db.execO<{ id: number }>(
		`INSERT INTO reconciliation_order (supplier_order_ids, created, updatedAt)
		VALUES (json_array(${multiplyString("?", supplierOrderIds.length)}), ?, ?) RETURNING id`,
		[...supplierOrderIds, timestamp, timestamp]
	);
	return recondOrder[0].id;
}

/**
 * Adds order lines or updates the quantity of existing isbns for an existing reconciliation order.
 * These are the _delivered_ books that an employee is adding by scanning their isbns.
 *
 * @param db
 * @param id - The ID of the reconciliation order
 * @param newLines - Array of objects containing ISBN and quantity to add/update
 * @throws Error if reconciliation order not found
 * @see apps/e2e/helpers/cr-sqlite.ts:addOrderLinesToReconciliationOrder
 */
export async function addOrderLinesToReconciliationOrder(db: DB, id: number, newLines: { isbn: string; quantity: number }[]) {
	const reconOrder = await db.execO<ReconciliationOrder>("SELECT * FROM reconciliation_order WHERE id = ?;", [id]);

	if (!reconOrder[0]) {
		throw new Error(`Reconciliation order ${id} not found`);
	}

	const params = newLines.map(({ isbn, quantity }) => [id, isbn, quantity]).flat();

	const timestamp = Date.now();

	await db.tx(async (txDb) => {
		const sql = `
			INSERT INTO reconciliation_order_lines (reconciliation_order_id, isbn, quantity)
			VALUES ${multiplyString("(?,?,?)", newLines.length)}
			ON CONFLICT(reconciliation_order_id, isbn) DO UPDATE SET
				quantity = quantity + excluded.quantity;
		`;
		await txDb.exec(sql, params);
		await txDb.exec("UPDATE reconciliation_order SET updatedAt = ? WHERE id = ?", [timestamp, id]);
	});
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
  * @see apps/e2e/helpers/cr-sqlite.ts:finalizeReconciliationOrder
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
		customerOrderLines = reconOrderLines.flatMap(({ isbn, quantity }) => Array(quantity).fill(isbn));
	} catch (e) {
		throw new Error(`Invalid customer order lines format in reconciliation order ${id}`);
	}

	const timestamp = Date.now();

	return db.tx(async (txDb) => {
		await txDb.exec(`UPDATE reconciliation_order SET finalized = 1 WHERE id = ?;`, [id]);

		console.log({ customerOrderLines });
		if (customerOrderLines.length > 0) {
			await txDb.exec(
				`
			 UPDATE customer_order_lines
 SET received = ?
 WHERE rowid IN (
     SELECT col.rowid
     FROM customer_order_lines col
     JOIN (
         SELECT isbn, ROW_NUMBER() OVER () as occurrence
         FROM json_each(?)
     ) requested ON col.isbn = requested.isbn
     WHERE col.placed IS NOT NULL
     AND col.received IS NULL
     AND (
         SELECT COUNT(*)
         FROM customer_order_lines col2
         WHERE col2.isbn = col.isbn
         AND col2.rowid <= col.rowid
         AND col2.placed IS NOT NULL
         AND col2.received IS NULL
     ) = requested.occurrence
 );  `,
				[timestamp, JSON.stringify(customerOrderLines)]
			);
		}
	});
}

/**
 * Retrieves all supplier orders that have not been selected for reconciliation in any `reconciliation_order`.
 * @param db
 *
 * @returns {Promise<PlacedSupplierOrder[]>} Array of unreconciled supplier orders with:
 */
export async function getUnreconciledSupplierOrders(db: DB): Promise<PlacedSupplierOrder[]> {
	const result = await db.execO<PlacedSupplierOrder>(
		` WITH Reconciled AS (
     SELECT CAST(value AS INTEGER) AS supplier_order_id
     FROM reconciliation_order AS ro
     CROSS JOIN json_each(ro.supplier_order_ids)
 )
 SELECT
     so.id,
     so.supplier_id,
     s.name AS supplier_name,
     so.created,
     COALESCE(SUM(sol.quantity), 0) AS total_book_number
 FROM supplier_order AS so
 JOIN supplier AS s
     ON so.supplier_id = s.id
 LEFT JOIN supplier_order_line AS sol
     ON sol.supplier_order_id = so.id
 LEFT JOIN Reconciled AS r
     ON r.supplier_order_id = so.id
 WHERE
     so.created IS NOT NULL
     AND r.supplier_order_id IS NULL
 GROUP BY
     so.id,
     so.supplier_id,
     s.name,
     so.created  `
	);

	return result;
}

/**
* Processes delivered books against placed order lines to identify matches an
discrepancies
*
* @param scannedBooks - Array of scanned books with their quantities
* @param placedOrderLines - Array of originally placed order lines from
supplier
*
* @returns Object containing:
*  - processedLines: Array of matched books with both ordered and delivered
quantities
*  - unmatchedBooks: Array of books that either:
*    - Were ordered but not delivered
*    - Were delivered but not in original order
*/
export const processOrderDelivery = (
	scannedBooks: (BookEntry & { quantity: number })[],
	placedOrderLines: PlacedSupplierOrderLine[]
): { processedLines: ProcessedOrderLine[]; unmatchedBooks: (BookEntry & { quantity: number })[] } => {
	const scannedLinesMap = new Map<string, BookEntry & { quantity: number }>(
		scannedBooks.map((book) => {
			return [book.isbn, book];
		})
	);
	const result = { processedLines: [], unmatchedBooks: [] };

	for (const placedOrderLine of placedOrderLines) {
		if (scannedLinesMap.has(placedOrderLine.isbn)) {
			const scannedBook = scannedLinesMap.get(placedOrderLine.isbn);
			scannedLinesMap.delete(placedOrderLine.isbn);
			result.processedLines.push({
				...placedOrderLine,
				deliveredQuantity: scannedBook.quantity,
				orderedQuantity: placedOrderLine.quantity
			});
		} else {
			result.processedLines.push({
				...placedOrderLine,
				deliveredQuantity: 0,
				orderedQuantity: placedOrderLine.quantity
			});
		}
	}
	result.unmatchedBooks = [...result.unmatchedBooks, ...scannedLinesMap.values()];

	return result;
};

/**
 * Groups processed order lines by supplier name
 *
 * @param orderLines - Array of processed order lines containing supplier information
 * @returns Object with supplier names as keys and arrays of their respective order lines as values
 */
export const sortLinesBySupplier = (orderLines: ProcessedOrderLine[]): { [supplier_name: string]: ProcessedOrderLine[] } => {
	return orderLines.reduce((acc, curr) => {
		return acc[curr.supplier_name]
			? { ...acc, [curr.supplier_name]: [...acc[curr.supplier_name], curr] }
			: { ...acc, [curr.supplier_name || "Supplier"]: [curr] };
	}, {});
};
