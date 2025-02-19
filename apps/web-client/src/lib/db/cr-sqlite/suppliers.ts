import type {
	DB,
	Supplier,
	PossibleSupplierOrder,
	PossibleSupplierOrderLine,
	PlacedSupplierOrder,
	PlacedSupplierOrderLine,
	SupplierExtended
} from "./types";

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

/** Internal query function: if id provided, filters by id, if not, returns data for all suppliers */
async function _getSuppliers(db: DB, id?: number) {
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
			COALESCE(email, 'N/A') as email,
			COALESCE(address, 'N/A') as address,
			COUNT(publisher) as numPublishers
		FROM supplier
		LEFT JOIN supplier_publisher ON supplier.id = supplier_publisher.supplier_id
		${whereClause}
		GROUP BY supplier.id
		ORDER BY supplier.id ASC
	`;

	return await db.execO<SupplierExtended>(query, params);
}

/**
 * Retrieves all suppliers from the database. This include their name, email, address & assigned publishers
 *
 * @param db - The database instance to query
 * @returns Promise resolving to an array of suppliers with their basic info
 */
export function getAllSuppliers(db: DB): Promise<SupplierExtended[]> {
	return _getSuppliers(db);
}

/**
 * Retrieves supplier data from the database. This include their name, email address & assigned publishers
 *
 * @param db - The database instance to query
 * @param id - supplier id
 */
export async function getSupplierDetails(db: DB, id: number): Promise<SupplierExtended | undefined> {
	const [res] = await _getSuppliers(db, id);
	return res || undefined;
}

/**
 * Updates an existing supplier or inserts a new one if it doesn't exist.
 *
 * @param db - The database instance to query
 * @param supplier - The supplier data to upsert
 * @throws {Error} If supplier.id is not provided
 * @see apps/e2e/helpers/cr-sqlite.ts:upsertSupplier when you make changes
 */
export async function upsertSupplier(db: DB, supplier: Supplier) {
	if (!supplier.id) {
		throw new Error("Supplier must have an id");
	}

	await db.exec(
		`INSERT INTO supplier (id, name, email, address)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
        	name = COALESCE(?, name),
            email = COALESCE(?, email),
            address = COALESCE(?, address);`,
		[
			supplier.id,
			supplier.name ?? null,
			supplier.email ?? null,
			supplier.address ?? null,
			supplier.name ?? null,
			supplier.email ?? null,
			supplier.address ?? null
		]
	);
}

/**
 * Retrieves all publishers associated with a specific supplier ordered alphabetically
 *
 * @param db - The database instance to query
 * @param supplierId - The id of the supplier
 * @returns Promise resolving to an array of publisher ids
 * @see apps/e2e/helpers/cr-sqlite.ts:associatePublisher when you make any changes
 */
export async function getPublishersFor(db: DB, supplierId: number): Promise<string[]> {
	const stmt = await db.prepare(
		`SELECT publisher
		FROM supplier_publisher
		WHERE supplier_id = ?
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
export async function associatePublisher(db: DB, supplierId: number, publisher: string) {
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
export async function removePublisherFromSupplier(db: DB, supplierId: number, publisher: string) {
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
export async function getPossibleSupplierOrders(db: DB): Promise<PossibleSupplierOrder[]> {
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
        WHERE col.placed IS NULL
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
export async function getPossibleSupplierOrderLines(db: DB, supplierId: number | null): Promise<PossibleSupplierOrderLine[]> {
	const conditions = ["col.placed is NULL"];
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
 * Retrieves all placed supplier orders with:
 * - order id & created timestamp
 * - supplier id & name
 * - a total book count
 *
 * Orders are returned sorted by creation date (newest first).
 *
 * @param db - The database instance to query
 * @returns Promise resolving to an array of placed supplier orders with supplier details and book counts
 */
export async function getPlacedSupplierOrders(db: DB, supplierId?: number): Promise<PlacedSupplierOrder[]> {
	const whereConditions = ["so.created IS NOT NULL"];
	const params = [];

	if (supplierId) {
		whereConditions.push("so.supplier_id = ?");
		params.push(supplierId);
	}

	const whereClause = `WHERE ${whereConditions.join(" AND ")}`;

	const query = `
		SELECT
            so.id,
            so.supplier_id,
            s.name as supplier_name,
            so.created,
            COALESCE(SUM(sol.quantity), 0) as total_book_number,
			SUM(COALESCE(book.price, 0) * sol.quantity) as total_book_price
        FROM supplier_order so
		LEFT JOIN supplier s ON s.id = so.supplier_id
		LEFT JOIN supplier_order_line sol ON sol.supplier_order_id = so.id
		LEFT JOIN book ON sol.isbn = book.isbn
		${whereClause}
        GROUP BY so.id, so.supplier_id, s.name, so.created
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
export async function getPlacedSupplierOrderLines(db: DB, supplier_order_ids: number[]): Promise<PlacedSupplierOrderLine[]> {
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
            so.supplier_id,
            so.created,
            s.name AS supplier_name,
            SUM(sol.quantity) OVER (PARTITION BY sol.supplier_order_id) AS total_book_number,
            SUM(COALESCE(book.price, 0) * sol.quantity) OVER (PARTITION BY sol.supplier_order_id) AS total_book_price
		FROM supplier_order_line AS sol
		LEFT JOIN book ON sol.isbn = book.isbn
        JOIN supplier_order so ON so.id = sol.supplier_order_id
        JOIN supplier s ON s.id = so.supplier_id
        WHERE sol.supplier_order_id IN (${multiplyString("?", supplier_order_ids.length)})
		GROUP BY sol.supplier_order_id, sol.isbn
        ORDER BY sol.supplier_order_id, sol.isbn ASC;
    `;

	return db.execO<PlacedSupplierOrderLine>(query, supplier_order_ids);
}

/**
 * TODO: I removed the getSupplierOrder query at the end of this because it seemed unnecessary, and it feels like it should be re-written inline with above structure
 * this currently returns nothing. We can rethink this
 *
 * Creates supplier orders based on provided order lines and updates related customer orders.
 *
 * @param db - The database instance to query
 * @param orderLines - The order lines to create supplier orders from
 * @returns Promise resolving to the created supplier orders
 * @todo Rewrite this function to accommodate for removing quantity in
 * @see apps/e2e/cr-sqlite.ts:createSupplierOrder when you make changes
customerOrderLine
 */
export async function createSupplierOrder(
	db: DB,
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
		const [[orderId]] = await db.execA("INSERT INTO supplier_order (supplier_id, created) VALUES (?, ?) RETURNING id", [
			supplierId,
			timestamp
		]);

		for (const orderLine of orderLines) {
			// Find the customer order lines corresponding to this supplier order line
			const _customerOrderLineIds = await db
				.execO<{
					id: number;
				}>("SELECT id FROM customer_order_lines WHERE isbn = ? AND placed is NULL ORDER BY created ASC", [orderLine.isbn])
				.then((res) => res.map(({ id }) => id));

			// NOTE: this is a really defnsive check:
			// - if there are not enough customer order lines to justify this order line, we should order (at maximum)
			//  the number of customer order lines available
			// - other constraint, ofc, is the number of quantity specified by the orderLines param
			//
			// TODO: we should really check this - potentially throw an error here and show a dialog in the UI confirming the order
			// - kinda like with out-of-stock outbound notes
			const quantity = Math.min(orderLine.quantity, _customerOrderLineIds.length);
			if (quantity < orderLine.quantity) {
				const msg = [
					"There are fewer customer order lines than requested by the supplier order line:",
					"  this isn't a problem as the final quantity will be truncated, but indicates a bug in calculating of possible supplier order lines:",
					`  isbn: ${orderLine.isbn}`,
					`  quantity requested: ${orderLine.quantity}`,
					`  quantity required (by customer order lines): ${_customerOrderLineIds.length}`
				];
				console.warn(msg);
			}
			// The truncated list of custome order line ids - the lines we need to update to "placed"
			const customerOrderLineIds = _customerOrderLineIds.slice(0, quantity);

			const idsPlaceholder = `(${multiplyString("?", customerOrderLineIds.length)})`;
			await db.exec(`UPDATE customer_order_lines SET placed = ? WHERE id IN ${idsPlaceholder}`, [timestamp, ...customerOrderLineIds]);

			await db.exec("INSERT INTO supplier_order_line (supplier_order_id, isbn, quantity) VALUES (?, ?, ?)", [
				orderId,
				orderLine.isbn,
				quantity
			]);
		}
	});
}

export const multiplyString = (str: string, n: number) => Array(n).fill(str).join(", ");
