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

import type { BookEntry } from "@librocco/db";
import { asc } from "@librocco/shared";

import type {
	DB,
	ProcessedOrderLine,
	ReconciliationOrder,
	ReconciliationOrderLine,
	PlacedSupplierOrderLine,
	DBReconciliationOrder
} from "./types";

import { multiplyString } from "./customers";

/** Thrown from `createReconciliationOrder` when some of the provided supplier order ids don't match any existing supplier orders */
export class ErrSupplierOrdersNotFound extends Error {
	constructor(providedIds: number[], foundIds: number[]) {
		const msg = [
			"some of the provided supplier order ids didn't match any existing supplier orders:",
			`  provided ids: ${providedIds}`,
			`  found ids: ${foundIds}`
		].join("\n");
		super(msg);
	}
}

/** Thrown from `createReconciliationOrder` when some of the provided supplier order ids are already associated with other reconciliation orders */
export class ErrSupplierOrdersAlreadyReconciling extends Error {
	constructor(providedIds: number[], conflicts: ReconciliationOrder[]) {
		const msg = [
			"some of the provided supplier order ids match supplier orders already associated with other reconciliation order(s)",
			`  provided ids: ${providedIds}`,
			`  conflicts:`,
			...conflicts
				.sort(asc(({ id }) => id))
				.map(
					({ id, supplierOrderIds }) => `    reconciliation order id: ${id}, conflicting supplier order ids: ${supplierOrderIds.join(", ")}`
				)
		].join("\n");
		super(msg);
	}
}

/**
 * Creates a new reconciliation order.
 * The array of supplier_order ids will be used to get the _ordered_ `supplier_order_lines` which the
 * delivered books will be compared against
 *
 * @param db
 * @param id - ID of the reconciliation order
 * @param supplierOrderIds - Array of su pplier order IDs to reconcile
 * @throws Error if supplierOrderIds array is empty
 * @returns ID of the newly created reconciliation order
 */
export async function createReconciliationOrder(db: DB, id: number, _supplierOrderIds: number[]): Promise<void> {
	if (!_supplierOrderIds.length) {
		throw new Error("Reconciliation order must be based on at least one supplier order");
	}

	// Tidiness: make sure supplier order ids are sorted
	const supplierOrderIds = _supplierOrderIds.sort(asc());

	const timestamp = Date.now();

	// Check that all provided supplier order ids match existing supplier orders
	const foundSupOrders = await db.execO<{ id: number }>(
		`SELECT id FROM supplier_order WHERE id IN (${multiplyString("?", supplierOrderIds.length)})`,
		supplierOrderIds
	);
	if (foundSupOrders.length != supplierOrderIds.length) {
		throw new ErrSupplierOrdersNotFound(
			supplierOrderIds,
			foundSupOrders.map(({ id }) => id)
		);
	}

	// Check if one or more orders are already being reconciled
	// TODO: This here would really benefit from having a join table instead of a JSON array
	const existingReconOrders = await getAllReconciliationOrders(db);
	const conflicts = existingReconOrders
		// For each order keep only the supplier order ids that are conflicting with the current order
		.map((order) => ({ ...order, supplierOrderIds: order.supplierOrderIds.filter((id) => supplierOrderIds.includes(id)) }))
		// Keep only the conflicting orders
		.filter((order) => order.supplierOrderIds.length);
	if (conflicts.length) {
		throw new ErrSupplierOrdersAlreadyReconciling(supplierOrderIds, conflicts);
	}

	await db.exec(
		`
			INSERT INTO reconciliation_order (id, supplier_order_ids, created, updatedAt)
			VALUES (?, json_array(${multiplyString("?", supplierOrderIds.length)}), ?, ?)
		`,
		[id, ...supplierOrderIds, timestamp, timestamp]
	);
}

/**
 * Retrieves all reconciliation orders from the database, ordered by ID
ascending
 * @param db
 * @param finalized - an optional boolean that's used to query finalized or non finalized orders
 * if not provided, all orders are fetched
 * @returns ReconciliationOrder array
 */
export async function getAllReconciliationOrders(db: DB, filters?: { finalized?: boolean }): Promise<ReconciliationOrder[]> {
	// Filter by finalized status if provided (return all otherwise)
	const whereClause = filters?.finalized === undefined ? "" : `WHERE finalized = ${Number(filters.finalized)}`;

	const result = await db.execO<DBReconciliationOrder>(`
		SELECT id, supplier_order_ids, finalized, updatedAt, created FROM reconciliation_order
		${whereClause}
		ORDER BY updatedAt DESC
	`);

	return result.map(unmarshalReconciliationOrder);
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
	const [result] = await db.execO<DBReconciliationOrder>(
		`
			SELECT id, supplier_order_ids, finalized, updatedAt, created
			FROM reconciliation_order WHERE id = ?
		`,
		[id]
	);

	if (!result) {
		return undefined;
	}

	return unmarshalReconciliationOrder(result);
}

const unmarshalReconciliationOrder = ({
	supplier_order_ids,
	created,
	updatedAt,
	finalized,
	...order
}: DBReconciliationOrder): ReconciliationOrder => {
	try {
		const supplierOrderIds = JSON.parse(supplier_order_ids);
		return { ...order, supplierOrderIds, created: new Date(created), updatedAt: new Date(updatedAt), finalized: Boolean(finalized) };
	} catch {
		const msg = [`Reconciliation order, id: ${order.id}: invalid json:`, `	supplier_order_ids: ${supplier_order_ids}`].join("\n");
		throw new Error(msg);
	}
};

/** Thrown from `addOrderLinesToReconciliationOrder` when the respective reconciliation order is not found */
export class ErrReconciliationOrderNotFound extends Error {
	constructor(id: number) {
		super(`Reconciliation order not found: trying to add lines to a non existing reconciliation order: id: ${id}`);
	}
}

/** Thrown from `addOrderLinesToReconciliationOrder` when trying to add lines to already finalized reconciliation order */
export class ErrReconciliationOrderFinalized extends Error {
	constructor(id: number);
	constructor(id: number, lines: { isbn: string; quantity: number }[]);
	constructor(id: number, lines?: { isbn: string; quantity: number }[]) {
		if (lines?.length) {
			const msg = [
				"Reconciliation order already finalized: trying to add lines to an already finalized reconciliation order:",
				`  order id: ${id}`,
				"  order lines:",
				...lines.sort(asc(({ isbn }) => isbn)).map(({ isbn, quantity }) => `    isbn: ${isbn}, quantity: ${quantity}`)
			].join("\n");
			super(msg);
		} else {
			super(`Reconciliation order already finalized: ${id}`);
		}
	}
}
/**
  * Deletes a reconciliation order and all its associated order lines from the
 database.
  * The deletion is performed as an atomic transaction to maintain data
 consistency.
  *
  * @param db - The database connection
  * @param id - The ID of the reconciliation order to delete
  *
  * @throws {Error} When:
  * - The reconciliation order with the given ID is not found
  * - The reconciliation order is already finalized
  * - Database transaction fails
  */
export async function deleteReconciliationOrder(db: DB, id: number): Promise<void> {
	const reconOrder = await db.execO<ReconciliationOrder>("SELECT * FROM reconciliation_order WHERE id = ?;", [id]);

	if (!reconOrder[0]) {
		throw new Error(`Reconciliation order ${id} not found`);
	}

	if (reconOrder[0].finalized) {
		throw new Error(`Cannot delete finalized reconciliation order ${id}`);
	}

	await db.tx(async (txDb) => {
		// Delete associated lines first
		await txDb.exec("DELETE FROM reconciliation_order_lines WHERE reconciliation_order_id = ?", [id]);
		// Then delete the order itself
		await txDb.exec("DELETE FROM reconciliation_order WHERE id = ?", [id]);
	});
}

/**
 * Adds order lines or updates the quantity of existing isbns for an existing reconciliation order.
 * These are the _delivered_ books that an employee is adding by scanning their isbns.
 *
 * @param db
 * @param id - The ID of the reconciliation order
 * @param newLines - Array of objects containing ISBN and quantity to add/update
 * @throws Error if reconciliation order not found
 */
export async function addOrderLinesToReconciliationOrder(db: DB, id: number, newLines: { isbn: string; quantity: number }[]) {
	const [reconOrder] = await db.execO<ReconciliationOrder>("SELECT * FROM reconciliation_order WHERE id = ?;", [id]);

	if (!reconOrder) {
		throw new ErrReconciliationOrderNotFound(id);
	}

	if (reconOrder.finalized) {
		throw new ErrReconciliationOrderFinalized(id, newLines);
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
 * Deletes a specific book (by ISBN) from a reconciliation order and updates the order's timestamp
 *
 * @param db - The database connection
 * @param id - The ID of the reconciliation order
 * @param isbn - The ISBN of the book to remove from the order
 * @throws {Error} When the reconciliation order with the given ID is not found or order is finalized
 */
export async function deleteOrderLineFromReconciliationOrder(db: DB, id: number, isbn: string) {
	const reconOrder = await db.execO<ReconciliationOrder>("SELECT * FROM reconciliation_order WHERE id = ?;", [id]);

	if (!reconOrder[0] || reconOrder[0].finalized) {
		throw new Error(`Reconciliation order ${id} not found or already finalized`);
	}

	const timestamp = Date.now();
	await db.tx(async (txDb) => {
		const sql = `
			DELETE FROM reconciliation_order_lines WHERE reconciliation_order_id = ? AND isbn = ?;
		`;
		await txDb.exec(sql, [id, isbn]);
		await txDb.exec("UPDATE reconciliation_order SET updatedAt = ? WHERE id = ?", [timestamp, id]);
	});
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
	// Check if the order exists
	// TODO: do we, prehaps, want this to fail silently ??
	const [reconOrder] = await db.execO<ReconciliationOrder>("SELECT * FROM reconciliation_order WHERE id = ?;", [id]);
	if (!reconOrder) {
		throw new ErrReconciliationOrderNotFound(id);
	}

	const result = await db.execO<ReconciliationOrderLine>(
		`
			SELECT
				rol.isbn,
				rol.quantity,
				rol.reconciliation_order_id,
				COALESCE(book.title, 'N/A') as title,
				COALESCE(book.authors, 'N/A') as authors,
				COALESCE(book.publisher, 'N/A') as publisher,
				COALESCE(book.price, 0) as price
			FROM reconciliation_order_lines as rol
			LEFT JOIN book ON rol.isbn = book.isbn
			WHERE reconciliation_order_id = ?
		`,
		[id]
	);

	return result;
}

/**
 * Finalizes a reconciliation order and updates corresponding customer order lines
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
	const reconOrder = await getReconciliationOrder(db, id);
	if (!reconOrder) {
		throw new ErrReconciliationOrderNotFound(id);
	}

	if (reconOrder.finalized) {
		throw new ErrReconciliationOrderFinalized(id);
	}

	const { supplierOrderIds } = reconOrder;

	const receivedLines = await db
		.execA<
			[isbn: string, quantity: number]
		>("SELECT isbn, quantity FROM reconciliation_order_lines WHERE reconciliation_order_id = ?", [id])
		.then((res) => new Map(res));

	const orderedLines = await db
		.execA<
			[isbn: string, quantity: number]
		>(`SELECT isbn, SUM(quantity) FROM supplier_order_line WHERE supplier_order_id IN (${multiplyString("?", supplierOrderIds.length)}) GROUP BY isbn ORDER BY isbn ASC`, supplierOrderIds)
		.then((res) => new Map(res));

	const overdeliveredLines = new Map<string, { ordered: number; delivered: number }>();

	return db.tx(async (txDb) => {
		await txDb.exec(`UPDATE reconciliation_order SET finalized = 1 WHERE id = ?;`, [id]);

		const timestamp = Date.now();

		const allISBNS = new Set([...orderedLines.keys(), ...receivedLines.keys()]);

		for (const isbn of allISBNS) {
			const orderedQuantity = orderedLines.get(isbn) || 0;
			const receivedQuantity = receivedLines.get(isbn) || 0;
			// The number of order lines that were ordered, but weren't delivered
			const rejectQuantity = orderedQuantity - receivedQuantity;

			// Check if some books were overdelivered
			if (rejectQuantity < 0) {
				overdeliveredLines.set(isbn, { ordered: orderedQuantity, delivered: receivedQuantity });
			}

			// Get all in-progress customer order lines for the isbn
			const customerOrderLines = await txDb.execO<{ id: number; placed: number | null }>(
				"SELECT id, placed FROM customer_order_lines WHERE isbn = ? AND received IS NULL ORDER BY created ASC",
				[isbn]
			);

			// Let n be the number of lines recevied
			// Let m be the number of lines to reject - difference of lines ordered and received
			//
			// We take the first n lines from the in-progress customer orders (and we do so by mutating the array - using splice).
			// Afterwards we take at most the last m lines from the leftover in-progress lines.
			//
			// The reason we do this is that, while there should always be at least n + m in-progress lines in the DB, the difference might happen,
			// so we're making sure we're resistant to that scenario.
			const receivedIds = customerOrderLines.splice(0, receivedQuantity).map(({ id }) => id);
			const rejectedIds = customerOrderLines
				.reverse()
				.filter(({ placed }) => Boolean(placed)) // here we're rejecting placed orders - make sure we're not rejecting non-placed orders (unwanted noop)
				.slice(0, Math.max(rejectQuantity, 0)) // min 0 to handle the case where rejectQuantity is negative (overdelivered)
				.map(({ id }) => id);

			// Mark the received books
			await txDb.exec(
				`
					UPDATE customer_order_lines
					SET received = ?
					WHERE id IN (${multiplyString("?", receivedIds.length)})
				`,
				[timestamp, ...receivedIds]
			);

			// Mark the rejected books
			await txDb.exec(
				`
					UPDATE customer_order_lines
					SET placed = NULL
					WHERE id IN (${multiplyString("?", rejectedIds.length)})
				`,
				rejectedIds
			);
		}

		// NOTE: It might happen that the number of books delivered is greater than the number of books ordered IN THIS SUPPLIER ORDER
		// With the current implementation we're merely warning the user of this fact, but might want to refactor so as to return the number of something
		//
		// NOTE: Currently, if the number delivered is greater for this supplier order, but there are additional customer order lines for a particular book,
		// they will be reconcile early and extra stock will happen only after there are no more customer order lines to receive, but the books keep coming in.
		if (overdeliveredLines.size > 0) {
			const msg = [
				"Number of books delivered is greater than the number of books ordered:",
				`  supplier order ids: ${supplierOrderIds.join(", ")}`
			];
			for (const [isbn, { ordered, delivered }] of overdeliveredLines) {
				msg.push(`  isbn: ${isbn},  ordered: ${ordered},  delivered: ${delivered}`);
			}

			console.warn(msg.join("\n"));
		}
	});
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
	const unmatchedBooks: (BookEntry & { quantity: number })[] = [];
	const processedLines: ProcessedOrderLine[] = [];

	// Create a map of scanned books for quick lookup
	const scannedBooksMap = new Map<string, BookEntry & { quantity: number }>();
	scannedBooks.forEach((scannedBook) => scannedBooksMap.set(scannedBook.isbn, scannedBook));

	// Process each placed order line
	for (const placedOrderLine of placedOrderLines) {
		const scannedBook = scannedBooksMap.get(placedOrderLine.isbn);

		if (scannedBook) {
			// Calculate delivered quantity
			const deliveredQuantity = Math.min(scannedBook.quantity, placedOrderLine.quantity);

			// Add to processed lines
			processedLines.push({
				...placedOrderLine,
				deliveredQuantity,
				orderedQuantity: placedOrderLine.quantity
			});

			// Update the remaining quantity in the scanned book
			const remainingQuantity = scannedBook.quantity - deliveredQuantity;
			if (remainingQuantity > 0) {
				scannedBooksMap.set(scannedBook.isbn, { ...scannedBook, quantity: remainingQuantity });
			} else {
				scannedBooksMap.delete(scannedBook.isbn);
			}
		} else {
			// If no matching scanned book, add to processed lines with deliveredQuantity = 0
			processedLines.push({
				...placedOrderLine,
				deliveredQuantity: 0,
				orderedQuantity: placedOrderLine.quantity
			});
		}
	}

	// Add remaining scanned books to unmatchedBooks
	unmatchedBooks.push(...Array.from(scannedBooksMap.values()));

	return { processedLines, unmatchedBooks };
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
