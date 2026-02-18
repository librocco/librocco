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

import { _group, asc, OrderItemStatus } from "@librocco/shared";

import type { DBAsync, TXAsync, ReconciliationOrder, ReconciliationOrderLine, DBReconciliationOrder } from "./types";

import { timed } from "$lib/utils/timer";

import { getCustomerOrderLinesCore, multiplyString } from "./customers";

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
async function _createReconciliationOrder(db: TXAsync, id: number, _supplierOrderIds: number[]): Promise<void> {
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
 * Retrieves all reconciliation orders from the database, ordered by ID ascending
 * @param db
 * @param finalized - an optional boolean that's used to query finalized or non finalized orders
 * if not provided, all orders are fetched
 * @returns ReconciliationOrder array
 */
async function _getAllReconciliationOrders(db: TXAsync, filters?: { finalized?: boolean }): Promise<ReconciliationOrder[]> {
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
 * @throws Error if order not found or if supplier_order_ids contains invalid JSON
 * @returns ReconciliationOrder with parsed supplier_order_ids
 */
async function _getReconciliationOrder(db: TXAsync, id: number): Promise<ReconciliationOrder & { supplierOrderIds: number[] }> {
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

/** Thrown from `upsertReconciliationOrderLines` when the respective reconciliation order is not found */
export class ErrReconciliationOrderNotFound extends Error {
	constructor(id: number) {
		super(`Reconciliation order not found: trying to add lines to a non existing reconciliation order: id: ${id}`);
	}
}

/** Thrown from `upsertReconciliationOrderLines` when trying to add lines to already finalized reconciliation order */
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
async function _deleteReconciliationOrder(db: DBAsync, id: number): Promise<void> {
	const reconOrder = await db.execO<ReconciliationOrder>("SELECT * FROM reconciliation_order WHERE id = ?;", [id]);

	if (!reconOrder[0]) {
		throw new ErrReconciliationOrderNotFound(id);
	}

	if (reconOrder[0].finalized) {
		throw new ErrReconciliationOrderFinalized(id);
	}

	await db.tx(async (txDb) => {
		// Delete associated lines first
		await txDb.exec("DELETE FROM reconciliation_order_lines WHERE reconciliation_order_id = ?", [id]);
		// Then delete the order itself
		await txDb.exec("DELETE FROM reconciliation_order WHERE id = ?", [id]);
	});
}

/**
  * Adds new order lines or updates quantities of existing lines for a
 reconciliation order.
  * For existing lines, the quantity is added to the current value (can be
 negative to decrease).
  *
  * @param db
  * @param id - The ID of the reconciliation order
  * @param lines - Array of objects containing ISBN and quantity to add/update
  * @throws Error if:
  * - Reconciliation order not found
  * - Order is already finalized
  */
async function _upsertReconciliationOrderLines(db: DBAsync, id: number, newLines: { isbn: string; quantity: number }[]) {
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
		// Clean up any lines that ended up with quantity <= 0
		await txDb.exec(
			`
       DELETE FROM reconciliation_order_lines
       WHERE reconciliation_order_id = ? AND quantity <= 0
     `,
			[id]
		);
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
async function _deleteOrderLineFromReconciliationOrder(db: DBAsync, id: number, isbn: string) {
	const reconOrder = await db.execO<ReconciliationOrder>("SELECT * FROM reconciliation_order WHERE id = ?;", [id]);

	if (!reconOrder[0]) {
		throw new ErrReconciliationOrderNotFound(id);
	}
	if (reconOrder[0].finalized) {
		throw new ErrReconciliationOrderFinalized(id);
	}

	const timestamp = Date.now();
	await db.tx(async (txDb) => {
		const exists = await txDb.execO<{ id: number }>(
			"SELECT 1 FROM reconciliation_order_lines WHERE reconciliation_order_id = ? AND isbn = ?",
			[id, isbn]
		);
		if (!exists.length) {
			throw new Error("No matching order line found");
		}
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
async function _getReconciliationOrderLines(db: TXAsync, id: number): Promise<ReconciliationOrderLine[]> {
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
 */
async function _finalizeReconciliationOrder(db: DBAsync, id: number) {
	const reconOrder = await getReconciliationOrder(db, id);
	if (!reconOrder) {
		throw new ErrReconciliationOrderNotFound(id);
	}

	if (reconOrder.finalized) {
		throw new ErrReconciliationOrderFinalized(id);
	}

	const { supplierOrderIds } = reconOrder;

	const receivedLinesQuery = `
		SELECT
			isbn,
			quantity
		FROM reconciliation_order_lines
		WHERE reconciliation_order_id = ?
	`;
	/** Running count of 'received' lines (lines scanned in this reconciliation order) */
	const receivedLineBudget = await db.execA<[isbn: string, quantity: number]>(receivedLinesQuery, [id]).then((res) => new Map(res));

	const supplierOrderLineQuery = `
		SELECT
			so.supplier_id,
			sol.supplier_order_id,
			sol.isbn,
			sol.quantity,
			so.created,
			COALESCE(s.underdelivery_policy, 0) AS underdelivery_policy
		FROM supplier_order_line sol
		LEFT JOIN supplier_order so ON sol.supplier_order_id = so.id
		LEFT JOIN supplier s ON so.supplier_id = s.id
		WHERE sol.supplier_order_id IN (${multiplyString("?", supplierOrderIds.length)})
		ORDER BY so.created ASC
	`;
	// Retrieve all supplier order lines associated with the reconciliation order
	type SupplierOrderLineItem = {
		supplier_id: number;
		supplier_order_id: number;
		isbn: string;
		quantity: number;
		underdelivery_policy: 0 | 1;
		created: number;
	};
	const supplierOrderLines = await db.execO<SupplierOrderLineItem>(supplierOrderLineQuery, supplierOrderIds);
	console.log({ supplierOrderLines });

	const isbns = [...new Set(supplierOrderLines.map(({ isbn }) => isbn))];
	const customerOrderLines = await getCustomerOrderLinesCore(db, { isbns, orderBy: "created ASC", status: { eq: OrderItemStatus.Placed } });
	/**
	 * Map { isbn => Array<customer order line id> }
	 * Map of running counts for placed customer orders (filled / rejected on first-come-first-serve basis)
	 */
	const customerOrdersByISBN = new Map<string, number[]>();
	for (const { isbn, id } of customerOrderLines) {
		const existing = customerOrdersByISBN.get(isbn) || [];
		existing.push(id);
		customerOrdersByISBN.set(isbn, existing);
	}

	// customer lines (ids) to mark as delivered
	const linesToDeliver: number[] = [];
	// customer lines (ids) to "reject" - mark as pending
	const linesToReject: number[] = [];
	// supplier order lines for continuation orders (this is groupped by supplier order below for parent <-> child order link)
	type ContinuationOrderLine = { parent_order_id: number; supplier_id: number; isbn: string; quantity: number };
	const continuationOrderLines: ContinuationOrderLine[] = [];

	// NOTE: since supplier orders lines are ordered by respective supplier order created timestamp, we're employing
	// first-come-first served policy to supplier order delivery.
	// TODO: check this: it's trivial when underdelivery_policy = pending, but might procude inconsistencies with underdelivery_policy = queue
	//
	// NOTE: we're not handling the overdelivery case: max number delivered is the total quantity of associated supplier order lines
	// (overdelivery beyond that is dropped).
	for (const { isbn, quantity: ordered, supplier_id, supplier_order_id, underdelivery_policy } of supplierOrderLines) {
		const budget = receivedLineBudget.get(isbn) || 0;
		const delivered = Math.min(ordered, budget);
		const remainingBudget = budget - delivered;
		const underdelivered = ordered - delivered;

		// Update the running received budget for isbn
		receivedLineBudget.set(isbn, remainingBudget);

		console.log({ delivered });

		// Mark customer order lines for delivery
		if (delivered > 0) {
			const customerOrderLines = customerOrdersByISBN.get(isbn) || [];

			// Really unexpected scenario
			if (customerOrderLines.length < delivered) {
				const msg = [
					"unexpected state: remaining placed customer order lines < delivered lines",
					`  isbn: ${isbn}`,
					`  delivered: ${delivered}`,
					`  remining customer orders: ${customerOrderLines.length}`
				].join("\n");
				throw new Error(msg);
			}

			const idsToDeliver = customerOrderLines.splice(0, delivered);

			linesToDeliver.push(...idsToDeliver);
			customerOrdersByISBN.set(isbn, customerOrderLines);
		}

		console.log({ underdelivery_policy });
		console.log({ underdelivered });

		// Underdelivered - reject
		if (underdelivered > 0 && underdelivery_policy === 0) {
			const customerOrderLines = customerOrdersByISBN.get(isbn) || [];

			// Really unexpected scenario
			if (customerOrderLines.length < underdelivered) {
				const msg = [
					"unexpected state: remaining placed customer order lines < underdelivered lines",
					`  isbn: ${isbn}`,
					`  underdelivered: ${underdelivered}`,
					`  remaining customer orders: ${customerOrderLines.length}`
				].join("\n");
				throw new Error(msg);
			}

			// NOTE: rejecting from the back (first-come-first-served -- last ordered first rejected)
			const idsToReject = customerOrderLines.splice(-underdelivered, underdelivered);

			linesToReject.push(...idsToReject);
			customerOrdersByISBN.set(isbn, customerOrderLines);
		}

		// Underdelivered - queue
		if (underdelivered > 0 && underdelivery_policy === 1) {
			continuationOrderLines.push({ isbn, quantity: underdelivered, supplier_id, parent_order_id: supplier_order_id });
		}
	}

	console.log(JSON.stringify({ linesToReject }));

	return db.tx(async (txDb) => {
		const timestamp = Date.now();
		await txDb.exec(`UPDATE reconciliation_order SET finalized = 1, updatedAt = ? WHERE id = ?;`, [timestamp, id]);

		if (linesToDeliver.length > 0) {
			await txDb.exec(`UPDATE customer_order_lines SET received = ? WHERE id IN (${multiplyString("?", linesToDeliver.length)})`, [
				timestamp,
				...linesToDeliver
			]);
		}

		if (linesToReject.length > 0) {
			await txDb.exec(`UPDATE customer_order_lines SET placed = NULL WHERE id IN (${multiplyString("?", linesToReject.length)})`, [
				...linesToReject
			]);
		}

		// Place continuation orders
		const continuationOrders = _group(continuationOrderLines, (line) => [line.parent_order_id, line]);
		for (const [parent_order_id, _lines] of continuationOrders) {
			const lines = [..._lines];

			const id = Math.floor(Math.random() * 1000000); // Temporary ID generation
			const supplierId = lines[0].supplier_id;

			await txDb.exec("INSERT INTO supplier_order (id, supplier_id, created) VALUES (?, ?, ?)", [id, supplierId, timestamp]);
			await txDb.exec("INSERT INTO supplier_order_continuation (parent_order_id, continuation_order_id) VALUES (?, ?)", [
				parent_order_id,
				id
			]);

			const placeholders = Array(lines.length).fill("(?, ?, ?)").join(",\n");
			const params = lines.flatMap(({ isbn, quantity }) => [id, isbn, quantity]);
			await txDb.exec(`INSERT INTO supplier_order_line (supplier_order_id, isbn, quantity) VALUES ${placeholders}`, params);
		}
	});
}

export const createReconciliationOrder = timed(_createReconciliationOrder);
export const getAllReconciliationOrders = timed(_getAllReconciliationOrders);
export const getReconciliationOrder = timed(_getReconciliationOrder);
export const deleteReconciliationOrder = timed(_deleteReconciliationOrder);
export const upsertReconciliationOrderLines = timed(_upsertReconciliationOrderLines);
export const deleteOrderLineFromReconciliationOrder = timed(_deleteOrderLineFromReconciliationOrder);
export const getReconciliationOrderLines = timed(_getReconciliationOrderLines);
export const finalizeReconciliationOrder = timed(_finalizeReconciliationOrder);
