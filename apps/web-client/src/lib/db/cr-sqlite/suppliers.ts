import type {
	DBAsync,
	TXAsync,
	Supplier,
	PossibleSupplierOrder,
	PossibleSupplierOrderLine,
	PlacedSupplierOrder,
	PlacedSupplierOrderLine,
	SupplierExtended,
	DBPlacedSupplierOrderLine
} from "./types";

import { timed } from "$lib/utils/timer";

/**
 * @fileoverview Supplier order management system
 *
 * Supplier Orders Overview:
 * - A supplier is configured to manage the book catalogue of multiple publishers
 * - Supplier orders are created from customer orders
 * - Orders can be created by selecting books from a working ("possible") batch of customer order lines.
 * - This batch is aggregated from customer_order_lines that have not been placed via relations between supplier-publisher-book-customer_order_line
 * - This batch includes books from new customer orders, as well as those that were marked as not delivered at the end of a reconciliation process (see reconciliation notes)
 * - An employee can select a subset of books from the working batch to reduce the cost of an individual order
 * - Note: that a working/"possible" orders only exist in the db as aggregations of customer_order_lines
 * - When a batch is ordered, a "placed" supplier order is created in the db
 *
 * Data Sources:
 * - The `supplier_order` table contains meta data about a placed order
 * - The `supplier_order_line` table contains the book data lines for a supplier order
 * - The `supplier_publisher` table relates suppliers to publishers
 * - The `supplier` table contains data about a supplier (name, email & address)
 */

/**
 * Retrieves all suppliers from the database. This include their name, email, address & assigned publishers
 *
 * @param db - The database instance to query
 * @returns Promise resolving to an array of suppliers with their basic info
 */
async function _getAllSuppliers(db: TXAsync): Promise<SupplierExtended[]> {
	const query = `
		SELECT
			supplier.id,
			name,
			COALESCE(email, 'N/A') as email,
			COALESCE(address, 'N/A') as address,
			COALESCE(customerId, 'N/A') as customerId,
			COALESCE(orderFormat, 'N/A') as orderFormat,
			COUNT(publisher) as numPublishers
		FROM supplier
		LEFT JOIN supplier_publisher ON supplier.id = supplier_publisher.supplier_id
		GROUP BY supplier.id
		ORDER BY supplier.id ASC
	`;

	return await db.execO<SupplierExtended>(query);
}

/**
 * Retrieves supplier data from the database. This include their name, email address & assigned publishers
 *
 * NOTE: Due to update form compatibility, this function doesn't provide fallbacks for optional fields and
 * such need to be handled by the consumer.
 *
 * @param db - The database instance to query
 * @param id - supplier id
 */
async function _getSupplierDetails(db: TXAsync, id: number): Promise<SupplierExtended | undefined> {
	const conditions = [];
	const params = [];

	if (id) {
		conditions.push("supplier.id = ?");
		params.push(id);
	}

	const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
	const query = `
		SELECT
			supplier.id,
			name,
			email,
			address,
			customerId,
			orderFormat,
			COUNT(publisher) as numPublishers
		FROM supplier
		LEFT JOIN supplier_publisher ON supplier.id = supplier_publisher.supplier_id
		${whereClause}
		GROUP BY supplier.id
		ORDER BY supplier.id ASC
	`;

	const [res] = await db.execO<SupplierExtended>(query, params);
	return res || undefined;
}

/**
 * Updates an existing supplier or inserts a new one if it doesn't exist.
 *
 * @param db - The database instance to query
 * @param supplier - The supplier data to upsert
 * @throws {Error} If supplier.id is not provided
 */
async function _upsertSupplier(db: TXAsync, supplier: Supplier) {
	if (!supplier.id) {
		throw new Error("Supplier must have an id");
	}

	await db.exec(
		`INSERT INTO supplier (id, name, email, address, customerId, orderFormat)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
        	name = COALESCE(?, name),
            email = COALESCE(?, email),
            address = COALESCE(?, address),
            customerId = COALESCE(?, customerId),
            orderFormat = COALESCE(?, orderFormat)
            ;`,
		[
			supplier.id,
			supplier.name ?? null,
			supplier.email ?? null,
			supplier.address ?? null,
			supplier.customerId ?? null,
			supplier.orderFormat ?? null,
			supplier.name ?? null,
			supplier.email ?? null,
			supplier.address ?? null,
			supplier.customerId ?? null,
			supplier.orderFormat ?? null
		]
	);
}

/**
 * Retrieves all publishers associated with a specific supplier ordered alphabetically
 *
 * @param db - The database instance to query
 * @param supplierId - The id of the supplier
 * @returns Promise resolving to an array of publisher ids
 */
async function _getPublishersFor(db: TXAsync, supplierId?: number): Promise<string[]> {
	const whereCondition = supplierId ? `WHERE supplier_id = ?` : "";
	const stmt = await db.prepare(
		`SELECT publisher
		FROM supplier_publisher
		${whereCondition}
		ORDER BY publisher ASC;`
	);

	// For some reason `stmt.all` does not accept a type arg. Docs say it should
	const result = (await stmt.all(null, supplierId)) as unknown as { publisher: string }[];

	return result.map(({ publisher }) => publisher);
}

/**
 * Associates a publisher with a supplier, updating any existing association.
 * If the publisher was associated with a different supplier, that association is replaced.
 *
 * @param db - The database instance to query
 * @param supplierId - The id of the supplier to associate to
 * @param publisher - The id of the publisher to associate
 */
async function _associatePublisher(db: TXAsync, supplierId: number, publisher: string) {
	/* Makes sure the given publisher is associated with the given supplier id.
     If necessary it disassociates a different supplier */
	await db.exec(
		`
			INSERT INTO supplier_publisher (supplier_id, publisher)
			VALUES (?, ?)
			ON CONFLICT(publisher) DO UPDATE SET
			supplier_id = ?
		`,
		[supplierId, publisher, supplierId]
	);
}

/** Removes a publisher from the list of publishers for a supplier */
async function _removePublisherFromSupplier(db: TXAsync, supplierId: number, publisher: string) {
	await db.exec("DELETE FROM supplier_publisher WHERE supplier_id = ? AND publisher = ?", [supplierId, publisher]);
}

/**
 * A default group for books whose publishers are not associated with a supplier
 */
export const DEFAULT_SUPPLIER_NAME = "General";

/**
 * Retrieves summaries of all supplies that have possible orders. This is based on unplaced customer order lines.
 * Each row represents a potential order for a supplier with an aggregated `total_book_number` and `total_book_price`.
 * The result is ordered by supplier name.
 * e.g
 * ```
 * [{ supplier_name: "Phantasy Books LTD", supplier_id: 2, total_book_number: 2, total_book_price: 10 },
 * { supplier_name: "Science Books LTD", supplier_id: 1, total_book_number: 2, total_book_price: 20 }]
 *```
 * There is a fallback category "General" for books that are not explicitly linked to any supplier,
 * ensuring all unplaced customer orders are accounted for, even if the supplier relationship is missing.
 *
 * @param db - The database instance to query
 * @returns Promise resolving to an array of supplier order summaries with supplier information
 */
async function _getPossibleSupplierOrders(db: TXAsync): Promise<PossibleSupplierOrder[]> {
	const query = `
		SELECT
            supplier_id,
			CASE WHEN supplier.id IS NULL
				THEN '${DEFAULT_SUPPLIER_NAME}'
				ELSE supplier.name
			END as supplier_name,
            COUNT(*) as total_book_number,
            SUM(COALESCE(book.price, 0)) as total_book_price
        FROM supplier
    	RIGHT JOIN supplier_publisher sp ON supplier.id = sp.supplier_id
        RIGHT JOIN book ON sp.publisher = book.publisher
        RIGHT JOIN customer_order_lines col ON book.isbn = col.isbn

		-- sometimes a book can be received before being placed with the supplier due to overdelivery
        WHERE col.placed IS NULL AND col.received IS NULL
        GROUP BY supplier.id, supplier.name
        ORDER BY supplier_name ASC
	`;

	return db.execO<PossibleSupplierOrder>(query);
}

/**
 * Retrieves a list of possible order lines for a specific supplier based on unplaced customer orders.
 * The resulting rows contains:
 * - supplier id & name
 * - book data: isbn, publisher, authors, title
 * - quantity: the aggregated quantity per isbn. Note: this is not editable in the UI.
 * - line_price: the quantity * the book given(data) price
 *
 * @param db - The database instance to query
 * @param supplierId - The ID of the supplier to get order lines for
 * @returns Promise resolving to an array of possible order lines for the specified supplier
 */
async function _getPossibleSupplierOrderLines(db: TXAsync, supplierId: number | null): Promise<PossibleSupplierOrderLine[]> {
	const conditions = [
		"col.placed is NULL",
		// sometimes a book can be received before being placed with the supplier due to overdelivery
		"col.received IS NULL"
	];
	const params = [];

	if (!supplierId) {
		conditions.push("supplier.id IS NULL");
	} else {
		conditions.push("supplier.id = ?");
		params.push(supplierId);
	}

	const whereClause = `WHERE ${conditions.join(" AND ")}`;

	const query = `
		SELECT
			supplier_id,
			CASE WHEN supplier.id IS NULL
				THEN '${DEFAULT_SUPPLIER_NAME}'
				ELSE supplier.name
			END as supplier_name,
			col.isbn,
    		COALESCE(book.title, 'N/A') AS title,
    		COALESCE(book.authors, 'N/A') AS authors,
			COUNT(*) as quantity,
			COALESCE(book.price, 0) as price,
			SUM(COALESCE(book.price, 0)) as line_price
       	FROM supplier
        RIGHT JOIN supplier_publisher sp ON supplier.id = sp.supplier_id
        RIGHT JOIN book ON sp.publisher = book.publisher
        RIGHT JOIN customer_order_lines col ON book.isbn = col.isbn
		${whereClause}
      	GROUP BY book.isbn
      	ORDER BY book.isbn ASC
	`;

	// We need to build a query that will yield all books we can order, grouped by supplier
	return db.execO<PossibleSupplierOrderLine>(query, params);
}

/**
  * Retrieves placed supplier orders with:
  * - order id & created timestamp
  * - supplier id & name
  * - a total book count
  *
  * Orders are returned sorted by creation date (newest first).
  *
  * Optionally, the results can be filtered by supplier id and reconciliation status:
  * - if `supplierId` is provided, only orders from the specified supplier are returned
  * - if `reconciled` is specified:
  *   - `true` returns all orders that are part of a reconciliation order **regerdless of the order being finalized**
  *   - `false` returns all orders that are not part of a reconciliation order
  *
  * @param db - The database instance to query
  * @returns Promise resolving to an array of placed supplier orders with
 supplier details and book counts
  */
async function _getPlacedSupplierOrders(
	db: TXAsync,
	filters?: { supplierId?: number; reconciled?: boolean; finalized?: boolean }
): Promise<PlacedSupplierOrder[]> {
	const whereConditions = ["so.created IS NOT NULL"];
	const params = [];

	if (filters?.supplierId) {
		whereConditions.push("so.supplier_id = ?");
		params.push(filters.supplierId);
	}

	if (filters?.reconciled !== undefined) {
		const condition = filters.reconciled ? "IS NOT NULL" : "IS NULL";
		whereConditions.push(`ro.id ${condition}`);
	}

	if (filters?.finalized !== undefined) {
		whereConditions.push(`COALESCE(ro.finalized, 0) = ${Number(filters.finalized)}`);
	}

	const whereClause = `WHERE ${whereConditions.join(" AND ")}`;

	const query = `
		-- reconciliation orders in case we want to filter with respect to orders being reconciled
		WITH ro AS (
			SELECT
				reconciliation_order.id,
				CAST (value AS INTEGER) as supplier_order_id,
				reconciliation_order.finalized,
				reconciliation_order.updatedAt
			FROM reconciliation_order
			CROSS JOIN json_each(supplier_order_ids)
		)

		SELECT
            so.id,
            so.supplier_id,
			CASE WHEN so.supplier_id IS NULL
				THEN '${DEFAULT_SUPPLIER_NAME}'
				ELSE s.name
			END as supplier_name,
            so.created,
            COALESCE(SUM(sol.quantity), 0) as total_book_number,
			SUM(COALESCE(book.price, 0) * sol.quantity) as total_book_price,
			ro.id as reconciliation_order_id,
			ro.updatedAt as reconciliation_last_updated_at
        FROM supplier_order so
		LEFT JOIN supplier s ON s.id = so.supplier_id
		LEFT JOIN supplier_order_line sol ON sol.supplier_order_id = so.id
		LEFT JOIN book ON sol.isbn = book.isbn
		LEFT JOIN ro ON so.id = ro.supplier_order_id
		${whereClause}
        GROUP BY so.id, so.supplier_id, s.name, so.created, ro.id
        ORDER BY so.created DESC
	`;

	return await db.execO<PlacedSupplierOrder>(query, params);
}

/**
 * Retrieves all supplier order lines for the provided `supplier_order_id`s.
 * Returns an ordered set of rows if multiple ids are provided.
 * Each row includes:
 * - line quantity
 * - book details
 * - supplier details
 * - supplier order details, including total book number and price
 *
 * @param db
 * @param supplier_order_id - supplier order to retrieve lines for
 * @returns array of place supplier order lines:
 **/
async function _getPlacedSupplierOrderLines(db: TXAsync, supplier_order_ids: number[]): Promise<PlacedSupplierOrderLine[]> {
	if (!supplier_order_ids.length) {
		return [];
	}

	const query = `
        SELECT
            sol.supplier_order_id,

            sol.isbn,
            sol.quantity,
			COALESCE(book.price, 0) * sol.quantity as line_price,

			COALESCE(book.title, 'N/A') AS title,
			COALESCE(book.authors, 'N/A') AS authors,
			COALESCE(book.publisher, '') as publisher,
			COALESCE(book.price, 0) as price,
			COALESCE(book.year, '') as year,
			COALESCE(book.edited_by, '') as editedBy,
			book.out_of_print,
			COALESCE(book.category, '') as category,

            so.supplier_id,
			CASE WHEN s.id IS NULL
				THEN '${DEFAULT_SUPPLIER_NAME}'
				ELSE s.name
			END as supplier_name,
            so.created,

            SUM(sol.quantity) OVER (PARTITION BY sol.supplier_order_id) AS total_book_number,
            SUM(COALESCE(book.price, 0) * sol.quantity) OVER (PARTITION BY sol.supplier_order_id) AS total_book_price
		FROM supplier_order_line AS sol
		LEFT JOIN book ON sol.isbn = book.isbn
        LEFT JOIN supplier_order so ON so.id = sol.supplier_order_id
        LEFT JOIN supplier s ON s.id = so.supplier_id
        WHERE sol.supplier_order_id IN (${multiplyString("?", supplier_order_ids.length)})
		GROUP BY sol.supplier_order_id, sol.isbn
        ORDER BY sol.supplier_order_id, sol.isbn ASC;
    `;

	const res = await db.execO<DBPlacedSupplierOrderLine>(query, supplier_order_ids);
	return res.map(({ out_of_print, ...rest }) => ({ ...rest, outOfPrint: Boolean(out_of_print) }));
}

/**
 * TODO: I removed the getSupplierOrder query at the end of this because it seemed unnecessary, and it feels like it should be re-written inline with above structure
 * this currently returns nothing. We can rethink this
 *
 * Creates supplier orders based on provided order lines and updates related customer orders.
 *
 * @param db - The database instance to query
 * @param id - supplier Order Id
 * @param supplierId - The id of the supplier to create the order for
 * @param orderLines - The order lines to create supplier orders from
 * @returns Promise<void>
 * @todo Rewrite this function to accommodate for removing quantity in customerOrderLine
 */
async function _createSupplierOrder(
	db: DBAsync,
	id: number,
	supplierId: number | null,
	orderLines: Pick<PossibleSupplierOrderLine, "supplier_id" | "isbn" | "quantity">[]
) {
	/** @TODO Rewrite this function to accomodate for removing quantity in customerOrderLine */

	if (!orderLines.length) {
		throw new Error("No order lines provided");
	}

	// Check if all order lines belong to the provided supplier
	// NOTE: This is really conservative/defensive - sholdn't really happen
	const faultyLines = orderLines.filter((line) => line.supplier_id !== supplierId);
	if (faultyLines.length) {
		const msg = [
			"All order lines must belong to the same supplier:",
			`  supplier id: ${supplierId}`,
			"  faulty lines:",
			...faultyLines.map((line) => JSON.stringify(line))
		].join("\n");
		throw new Error(msg);
	}

	await db.tx(async (db) => {
		const timestamp = Date.now();

		// Create a supplier order
		// TODO: check how conflict - free (when syncing) this way of assigning ids is
		await db.execA("INSERT INTO supplier_order (id, supplier_id, created) VALUES (?, ?, ?)", [id, supplierId, timestamp]);

		for (const { isbn, quantity } of orderLines) {
			// Find the customer order lines corresponding to this supplier order line
			//
			// NOTE: Currently we're allowing for ordering of any number of books for an ISBN, regardless of the number of customer orders
			// requiring that books. This had proved to be a much simpler solution, trading off a check for an edge case of astronomical probability
			//
			// Keep in mind: any number of books can be ordered (placed with a supplier), but only the existing customer order lines will be marked as placed
			const customerOrderLineIds = await db
				.execO<{
					id: number;
				}>("SELECT id FROM customer_order_lines WHERE isbn = ? AND placed is NULL ORDER BY created ASC LIMIT ?", [isbn, quantity])
				.then((res) => res.map(({ id }) => id));

			const idsPlaceholder = `(${multiplyString("?", customerOrderLineIds.length)})`;
			await db.exec(`UPDATE customer_order_lines SET placed = ? WHERE id IN ${idsPlaceholder}`, [timestamp, ...customerOrderLineIds]);

			await db.exec("INSERT INTO supplier_order_line (supplier_order_id, isbn, quantity) VALUES (?, ?, ?)", [id, isbn, quantity]);

			const values = customerOrderLineIds.map((cLineId) => [cLineId, timestamp, id]);

			// NOTE: In most cases there WILL be customer orders corresponding to the supplier order lines, however, we're allowing to create a number of supplier
			// order lines unrelated to existing customer orders - we utilise this to simplify tests, so it's important to check to not end up with an incomplete SQL statement
			if (values.length) {
				await db.exec(
					`INSERT INTO customer_order_line_supplier_order (customer_order_line_id, placed, supplier_order_id) VALUES ${multiplyString("(?, ?, ?)", values.length)}`,
					values.flat()
				);
			}
		}
	});
}

export const multiplyString = (str: string, n: number) => Array(n).fill(str).join(", ");
export const getAllSuppliers = timed(_getAllSuppliers);
export const getSupplierDetails = timed(_getSupplierDetails);
export const upsertSupplier = timed(_upsertSupplier);
export const getPublishersFor = timed(_getPublishersFor);
export const associatePublisher = timed(_associatePublisher);
export const removePublisherFromSupplier = timed(_removePublisherFromSupplier);
export const getPossibleSupplierOrders = timed(_getPossibleSupplierOrders);
export const getPossibleSupplierOrderLines = timed(_getPossibleSupplierOrderLines);
export const getPlacedSupplierOrders = timed(_getPlacedSupplierOrders);
export const getPlacedSupplierOrderLines = timed(_getPlacedSupplierOrderLines);
export const createSupplierOrder = timed(_createSupplierOrder);
