/**
 * @fileoverview Customer order management system
 *
 * Customer Orders Overview:
 * - A customer order in the DB is some customer information (email, id, deposit)
 * - Conceptually, customer orders are implicit groupings of order lines, associated with the customer information
 * - Order lines are created in "draft" state and transition through states based on timestamps
 *
 * Order Line States:
 * - Draft: Has created timestamp (inital state)
 * - Placed: Has placed timestamp (order sent to supplier)
 * - Received: Has received timestamp (books arrived from supplier)
 * - Collected: Has collected timestamp (customer picked up books)
 *
 * Data Sources:
 * - customer_order_lines table:
 *   - id: Primary key
 *   - customer_id: References customer
 *   - isbn: Book identifier
 *   - created: Timestamp when line created
 *   - placed: Timestamp when sent to supplier
 *   - received: Timestamp when books arrived
 *   - collected: Timestamp when customer collected
 *
 * Key Implementation Notes:
 * - No explicit "order" concept - just collections of order lines
 * - Book details (title, price etc) come from separate book data source
 * - Status is derived from presence/absence of timestamps
 */

import type { DB, Customer, DBCustomerOrderLine, CustomerOrderLine, BookLine } from "./types";

/**
 * Retrieves all customers from the database.
 * Returns basic customer information ordered by ID.
 *
 * @param {DB} db - Database connection
 * @returns {Promise<Customer[]>} Array of customers
 */
export async function getAllCustomers(db: DB): Promise<Customer[]> {
	const result = await db.execO<Customer>("SELECT id, fullname, email, updatedAt, deposit FROM customer ORDER BY id ASC;");
	return result;
}

/**
 * Creates a new customer or updates an existing one.
 * Uses customer ID as the unique identifier for upsert operations.
 * Updates the customer's lastModified timestamp automatically.
 * All fields except ID are optional and will only be updated if provided.
 *
 * @param {DB} db - Database connection
 * @param {Customer} customer - Customer data
 * @throws {Error} If customer ID is not provided
 * @returns {Promise<void>} Resolves when customer is created/updated
 */
export async function upsertCustomer(db: DB, customer: Customer) {
	if (!customer.id) {
		throw new Error("Customer must have an id");
	}

	if (!customer.displayId) {
		throw new Error("Customer must have a displayId");
	}

	await db.exec(
		`INSERT INTO customer (id, fullname, email, deposit, display_id)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           fullname = COALESCE(?, fullname),
           email = COALESCE(?, email),
           updatedAt = (strftime('%s', 'now') * 1000),
           deposit = COALESCE(?, deposit),
           display_id = COALESCE(?, display_id);`,
		[
			customer.id,
			customer.fullname ?? null,
			customer.email ?? null,
			customer.deposit ?? null,
			customer.displayId,
			customer.fullname ?? null,
			customer.email ?? null,
			customer.deposit ?? null,
			customer.displayId
		]
	);
}

/**
 * Retrieves all customer order lines from the database.
 *
 * @param {DB} db - The database connection instance
 * @returns {Promise<DBCustomerOrderLine[]>} A promise that resolves to an arr of customer order lines
 * as they are stored in the database
 * A customer order line represents a single book in a customer order
 * the book meta data & timestamps to indicate when/if it has been placed, ordered with the supplier or received
 */
export const getAllCustomerOrderLines = async (db: DB): Promise<DBCustomerOrderLine[]> => {
	const result = await db.execO<DBCustomerOrderLine>(
		`SELECT customer_order_lines.id, customer_id, isbn, created, placed, received, collected
		FROM customer_order_lines`
	);

	return result;
};

/**
 * Retrieves all book order lines for a specific customer.
 * Includes both active and historical orders.
 * Groups orders by supplier order IDs if applicable.
 * Orders are returned sorted by ID (oldest first).
 *
 * @param {DB} db - Database connection
 * @param {number} customerId - Customer to query orders for
 * @returns {Promise<CustomerOrderLine[]>} Customer's order lines
 */
export const getCustomerBooks = async (db: DB, customerId: number): Promise<CustomerOrderLine[]> => {
	const result = await db.execO<DBCustomerOrderLine>(
		`SELECT
			customer_order_lines.id,
			customer_order_lines.isbn,
			customer_order_lines.customer_id,
			customer_order_lines.created,
			customer_order_lines.placed,
			customer_order_lines.received,
			customer_order_lines.collected,
			GROUP_CONCAT(customer_supplier_order.id) as supplierOrderIds,
			COALESCE(book.title, 'N/A') AS title,
			COALESCE(book.price, 0) AS price,
			COALESCE(book.year, 'N/A') AS year,
			COALESCE(book.authors, 'N/A') AS authors,
			COALESCE(book.publisher, '') AS publisher,
			COALESCE(book.edited_by, '') AS editedBy,
			book.out_of_print,
			COALESCE(book.category, '') AS category
		FROM customer_order_lines
		LEFT JOIN customer_supplier_order ON customer_order_lines.id = customer_supplier_order.customer_order_line_id
		LEFT JOIN book ON customer_order_lines.isbn = book.isbn
		WHERE customer_id = $customerId
		GROUP BY customer_order_lines.id, customer_order_lines.isbn, created, placed, received, collected
		ORDER BY customer_order_lines.id ASC;`,
		[customerId]
	);
	return result.map(marshallCustomerOrderLine);
};

/**
 * Retrieves customer details from the database for a specific customer ID.
 *
 * @param {DB} db - The database connection instance
 * @param {number} customerId - The unique identifier of the customer
 * @returns {Promise<Customer[]>} A promise that resolves to an array of customer details
 *                               containing id, fullname, deposit, and email information
 */
export const getCustomerDetails = async (db: DB, customerId: number): Promise<Customer[]> => {
	const result = await db.execO<Customer>("SELECT id, fullname, deposit, email, updatedAt FROM customer WHERE id = $customerId;", [
		customerId
	]);

	return result;
};

/**
 * Converts a database customer order line to an application customer order line.
 * This transformation primarily involves converting timestamp numbers to Date objects
 * and parsing the supplier order IDs string into an array of numbers.
 *
 * @param {DBCustomerOrderLine} line - The database representation of a customer order line
 * @returns {CustomerOrderLine} The application representation of a customer order line with proper date objects
 *
 * @example
 * const dbLine = {
 *   created: 1638316800000,
 *   placed: 1638403200000,
 *   supplierOrderIds: "1,2,3"
 * };
 * const appLine = marshallCustomerOrderLine(dbLine);
 * // Returns: { created: Date(...), placed: Date(...), supplierOrderIds: [1,2,3] }
 */
export const marshallCustomerOrderLine = (line: DBCustomerOrderLine): CustomerOrderLine => {
	return {
		...line,
		created: new Date(line.created),
		placed: line.placed ? new Date(line.placed) : undefined,
		received: line.received ? new Date(line.received) : undefined,
		collected: line.collected ? new Date(line.collected) : undefined,
		supplierOrderIds: line.supplierOrderIds ? line.supplierOrderIds.split(",").map(Number) : [],
		outOfPrint: Boolean(line.out_of_print)
	};
};

/**
 * Adds multiple books that associate with a specific customer's order a
 * updates the customer's last modified timestamp.
 *
 * @param {DB} db - The database connection instance
 * @param {number} customerId - The unique identifier of the customer
 * @param {BookLine[]} books - Array of books to add, each containing ISBN
 * @returns {Promise<void>} A promise that resolves when both operations complete successfully
 * @throws {Error} If the database transaction fails
 */
export const addBooksToCustomer = async (db: DB, customerId: number, books: BookLine[]): Promise<void> => {
	/**
	 * @TODO the customerId is persisted with a decimal point,
	 * converting it to a string here resulted in the book not getting persisted
	 */
	const params = books.map((book) => [customerId, book.isbn]).flat();
	const sql = `
     INSERT INTO customer_order_lines (customer_id, isbn)
     VALUES ${multiplyString("(?,?)", books.length)};`;

	await db.exec(sql, params);
};

export const getCustomerDisplayIdSeq = async (db: DB): Promise<number> => {
	const [result] = await db.execO<{ nextId: number }>("SELECT COALESCE(MAX(CAST(display_id AS INTEGER)) + 1, 1) as nextId FROM customer;");
	return result.nextId;
};

// Example: multiplyString("foo", 5) → "foo, foo, foo, foo, foo"
export const multiplyString = (str: string, n: number) => Array(n).fill(str).join(", ");

/**
 * Removes books associated with a specific customer's order
 * updates the customer's last modified timestamp.
 * The function executes both operations in a single transaction to ensure data consistency.
 *
 * @param {DB} db - The database connection instance
 * @param {number} customerId - The unique identifier of the customer
 * @param {number[]} bookIds - Array of book order line IDs to remove
 * @returns {Promise<void>} A promise that resolves when both the deletion and timestamp update are complete
 * @throws {Error} If either the deletion or timestamp update fails, the entire transaction is rolled back
 * @example
 * await removeBooksFromCustomer(db, 123, [456, 789]); // Removes order lines 456 and 789 from customer 123
 */
export const removeBooksFromCustomer = async (db: DB, customerId: number, bookIds: number[]): Promise<void> => {
	const sql = `DELETE FROM customer_order_lines WHERE customer_id = ? AND id IN (${multiplyString("?", bookIds.length)})`;
	const params = [customerId, ...bookIds];

	await db.exec(sql, params);
};

/**
 * Marks customer order lines as received when supplier order lines are fulfilled.
 * For each supplied ISBN, it updates the earliest unfulfilled customer order line
 * (that has been placed but not received) with the current timestamp as received date.
 *
 * @param {DB} db - The database connection instance
 * @param {isbns[]} isbns - Array of supplier order line isbns that have been received
 * @returns {Promise<void>} A promise that resolves when all relevant customer orders are marked as received
 *
 * @remarks
 * - Only updates the earliest unfulfilled order line for each ISBN
 * - Only updates order lines that have been placed but not yet received
 * - Updates are performed in a single transaction
 * - If supplierOrderLines is empty, the function returns immediately
 *
 * @example
 * await markCustomerOrderAsReceived(db, [
 *   { isbn: "123456789" },
 *   { isbn: "987654321" }
 * ]);
 */

export const markCustomerOrderAsReceived = async (db: DB, isbns: string[]): Promise<void> => {
	if (!isbns.length) return;
	return db.tx(async (txDb) => {
		const placeholders = multiplyString("?", isbns.length);
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
			isbns
		);
	});
};
