import type { DB, Supplier, SupplierOrderInfo, SupplierOrderLine, SupplierPlacedOrder } from "./types";

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
 * Retrieves all suppliers from the database. This include their name, email & address.
 *
 * @param db - The database instance to query
 * @returns Promise resolving to an array of suppliers with their basic info
 */
export async function getAllSuppliers(db: DB): Promise<Supplier[]> {
	const result = await db.execO<Supplier>("SELECT id, name, email, address FROM supplier ORDER BY id ASC;");
	return result;
}
/**
 * Updates an existing supplier or inserts a new one if it doesn't exist.
 *
 * @param db - The database instance to query
 * @param supplier - The supplier data to upsert
 * @throws {Error} If supplier.id is not provided
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
		[supplier.id, supplier.name ?? null, supplier.email ?? null, supplier.address ?? null]
	);
}
/**
 * Retrieves all publishers associated with a specific supplier.
 *
 * @param db - The database instance to query
 * @param supplierId - The id of the supplier
 * @returns Promise resolving to an array of publisher ids
 */
export async function getPublishersFor(db: DB, supplierId: number): Promise<string[]> {
	const result = await db.execA("SELECT publisher FROM supplier_publisher WHERE supplier_id = ?;", [supplierId]);
	if (result.length > 0) {
		return result[0];
	}
	return [];
}
/**
 * Associates a publisher with a supplier, updating any existing association.
 * If the publisher was associated with a different supplier, that association is replaced.
 *
 * @param db - The database instance to query
 * @param supplierId - The id of the supplier to associate to
 * @param publisherId - The id of the publisher to associate
 */
export async function associatePublisher(db: DB, supplierId: number, publisherId: string) {
	/* Makes sure the given publisher is associated with the given supplier id.
     If necessary it disassociates a different supplier */
	await db.exec(
		`INSERT INTO supplier_publisher (supplier_id, publisher)
         VALUES (?, ?)
         ON CONFLICT(publisher) DO UPDATE SET
           supplier_id = ?;`,
		[supplierId, publisherId, supplierId]
	);
}
/**
  * Retrieves all unplaced customer orders which are equivalent to possible order lines that can be created.
  * Groups books by supplier based on publisher associations.
  *
  * @param db - The database instance to query
  * @returns Promise resolving to an array of possible order lines with supplie
 and book information
  */
export async function getPossibleSupplerOrderLines(db: DB): Promise<SupplierOrderLine[]> {
	// We need to build a query that will yield all books we can order, grouped by supplier
	const result = await db.execO<SupplierOrderLine>(
		`SELECT
			supplier_id, supplier.name as supplier_name,
			book.isbn,
			COUNT(*) as quantity
       FROM supplier
        JOIN supplier_publisher ON supplier.id = supplier_publisher.supplier_id
        JOIN book ON supplier_publisher.publisher = book.publisher
        JOIN customer_order_lines ON book.isbn = customer_order_lines.isbn
      WHERE placed is NULL
      GROUP BY supplier_id, book.isbn
      ORDER BY book.isbn ASC;`
	);
	return result;
}

/**
 * Retrieves summaries of all supplies that have possible orders. This is based on unplaced customer order lines.
 * Each row represents a potential order for a supplier with an aggregated `total_book_number` and `total_book_price`.
 * The result is rdered by supplier name.
 * e.g
 * ```
 * [{ supplier_name: "Phantasy Books LTD", supplier_id: 2, total_book_number: 2, total_book_price: 10 },
 * { supplier_name: "Science Books LTD", supplier_id: 1, total_book_number: 2, total_book_price: 20 }]
 *```
 * @param db - The database instance to query
 * @returns Promise resolving to an array of supplier order summaries with supplier information
 */
export async function getPossibleSupplierOrders(db: DB): Promise<(SupplierOrderInfo & { supplier_name: string })[]> {
	const result = await db.execO<SupplierOrderInfo & { supplier_name: string }>(
		`SELECT
             supplier.name as supplier_name,
             supplier_id,
             COUNT(*) as total_book_number,
             SUM(book.price) as total_book_price
         FROM supplier
             JOIN supplier_publisher ON supplier.id =
 supplier_publisher.supplier_id
             JOIN book ON supplier_publisher.publisher = book.publisher
             JOIN customer_order_lines ON book.isbn = customer_order_lines.isbn
         WHERE customer_order_lines.placed IS NULL
         GROUP BY supplier.id, supplier.name
         ORDER BY supplier.name ASC;`
	);
	return result;
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
export async function getPossibleSupplierOrderLines(db: DB, supplierId: number): Promise<SupplierOrderLine[]> {
	// We need to build a query that will yield all books we can order, grouped by supplier
	const result = await db.execO<SupplierOrderLine>(
		`SELECT
					supplier_id, supplier.name as supplier_name,
					book.isbn, book.title, book.authors, book.publisher,
					COUNT(*) as quantity, SUM(book.price) as line_price
       FROM supplier
        JOIN supplier_publisher ON supplier.id = supplier_publisher.supplier_id
        JOIN book ON supplier_publisher.publisher = book.publisher
        JOIN customer_order_lines ON book.isbn = customer_order_lines.isbn
      WHERE customer_order_lines.placed is NULL AND supplier_id = ?
      GROUP BY book.isbn
      ORDER BY book.isbn ASC;`,
		[supplierId]
	);
	return result;
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
  * @returns Promise resolving to an array of placed supplier orders with
 supplier details and book counts
  */
export async function getPlacedSupplierOrders(db: DB): Promise<SupplierPlacedOrder[]> {
	const result = await db.execO<SupplierPlacedOrder>(
		`SELECT
             so.id,
             so.supplier_id,
             s.name as supplier_name,
             so.created,
             COALESCE(SUM(sol.quantity), 0) as total_book_number
         FROM supplier_order so
         JOIN supplier s ON s.id = so.supplier_id
         LEFT JOIN supplier_order_line sol ON sol.supplier_order_id = so.id
         WHERE so.created IS NOT NULL
         GROUP BY so.id, so.supplier_id, s.name, so.created
         ORDER BY so.created DESC;`
	);
	return result;
}

// TODO: this will be needed in the missing "placed" supplier order view
// export async function getPlacedSupplierOrderLines(db: DB, supplier_id: number): Promise<SupplierPlacedOrder[]> {}

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
customerOrderLine
 */
export async function createSupplierOrder(db: DB, orderLines: SupplierOrderLine[]) {
	/** @TODO Rewrite this function to accomodate for removing quantity in customerOrderLine */
	// Creates one or more supplier orders with the given order lines. Updates customer order lines to reflect the order.
	// Returns one or more `SupplierOrder` as they would be returned by `getSupplierOrder`

	const supplierOrderMapping = {};
	// Collect all supplier ids involved in the order lines
	const supplierIds = Array.from(new Set(orderLines.map((item) => item.supplier_id)));

	await db.tx(async (passedDb) => {
		const db: DB = passedDb as DB;
		for (const supplierId of supplierIds) {
			// Create a new supplier order for each supplier
			const newSupplierOrderId = (
				await db.execA(
					`INSERT INTO supplier_order (supplier_id)
			      VALUES (?) RETURNING id;`,
					[supplierId]
				)
			)[0][0];
			// Save the newly created supplier order id
			supplierOrderMapping[supplierId] = newSupplierOrderId;
		}

		for (const orderLine of orderLines) {
			// Find the customer order lines corresponding to this supplier order line
			const customerOrderLines = await db.execO<any>(
				// TODO: write tests to check the sorting by order creation
				`SELECT id, isbn FROM customer_order_lines WHERE isbn = ? AND placed is NULL ORDER BY created ASC;`,
				[orderLine.isbn]
			);

			let copiesToGo = orderLine.quantity;
			while (copiesToGo > 0) {
				const customerOrderLine = customerOrderLines.shift();
				if (customerOrderLine) {
					// The whole line can be fulfilled
					await db.exec(`UPDATE customer_order_lines SET placed = (strftime('%s', 'now') * 1000) WHERE id = ?;`, [customerOrderLine.id]);
					// To think about: maybe a better time to create this row is when the order proceeds to the next state:
					// at that point we will mark books as "we tried to order them in this order here"
					// In a scenario where a customer cancels a book order, and another comes by and orders the same book,
					// we don't want the canceled one to be marked with the order id.
					// Consider this timeline:
					// Order is sent - includes 10x book A
					// Customer YYY cancels their order for book A
					// Customer ZZZ orders book A
					// Order comes in. No Book A was delivered: it's not currently available.
					// We ordered 10 copies. We will mark 10 copies worth of customer orders as "we tried to order them"
					// not including the canceled order.
					await db.exec(`INSERT INTO customer_supplier_order (customer_order_line_id, supplier_order_id) VALUES (?, ?);`, [
						customerOrderLine.id,
						supplierOrderMapping[orderLine.supplier_id]
					]);
				}
				copiesToGo--;
			}
			await db.exec(
				`INSERT INTO supplier_order_line (supplier_order_id, isbn, quantity)
	      VALUES (?, ?, ?);`,
				[supplierOrderMapping[orderLine.supplier_id], orderLine.isbn, orderLine.quantity]
			);
		}
	});
}
