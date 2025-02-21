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

import type { DB, Customer, CustomerOrderLine, CustomerOrderLineHistory } from "./types";

type DBCustomerOrderLine = Omit<CustomerOrderLine, "created" | "placed" | "received" | "collected"> & {
	created: number; // as milliseconds since epoch
	placed?: number; // as milliseconds since epoch
	received?: number; // as milliseconds since epoch
	collected?: number; // as milliseconds since epoch
};

/**
 * Retrieves all customers from the database.
 * Returns basic customer information ordered by ID.
 *
 * @param {DB} db - Database connection
 * @returns {Promise<Customer[]>} Array of customers
 */
export async function getAllCustomers(db: DB): Promise<Customer[]> {
	const res = await db.execO<Omit<Customer, "updatedAt"> & { updated_at: number }>(
		"SELECT id, display_id AS displayId, fullname, email, updated_at, deposit FROM customer ORDER BY id ASC;"
	);
	return res.map(({ updated_at, ...row }) => ({ ...row, updatedAt: new Date(updated_at) }));
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
 * @see apps/e2e/helpers/cr-sqlite.ts:upsertCustomer when you make updates
 */
export async function upsertCustomer(db: DB, customer: Customer) {
	if (!customer.id) {
		throw new Error("Customer must have an id");
	}

	if (!customer.displayId) {
		throw new Error("Customer must have a displayId");
	}

	const timestamp = Date.now();

	await db.exec(
		`INSERT INTO customer (id, fullname, email, deposit, display_id, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           fullname = COALESCE(?, fullname),
           email = COALESCE(?, email),
           deposit = COALESCE(?, deposit),
           display_id = COALESCE(?, display_id),
           updated_at = ?
		   `,
		[
			customer.id,
			customer.fullname ?? null,
			customer.email ?? null,
			customer.deposit ?? null,
			customer.displayId,
			timestamp,
			customer.fullname ?? null,
			customer.email ?? null,
			customer.deposit ?? null,
			customer.displayId,
			timestamp
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
 * Retrieves all book order lines for a specific customer. This includes both active and historical orders.
 * Lines include book data that is displayed in the customer orders table: title, price, authors
 * Orders are returned sorted by ID (oldest first).
 *
 * @param {DB} db - Database connection
 * @param {number} customerId - Customer to query orders for
 * @returns {Promise<CustomerOrderLine[]>} Customer's order lines
 */
export const getCustomerOrderLines = async (db: DB, customerId: number): Promise<CustomerOrderLine[]> => {
	const result = await db.execO<DBCustomerOrderLine>(
		`SELECT
			id, customer_id, created, placed, received, collected,
			col.isbn,
			COALESCE(book.title, 'N/A') AS title,
			COALESCE(book.price, 0) AS price,
			COALESCE(book.authors, 'N/A') AS authors
		FROM customer_order_lines col
		LEFT JOIN book ON col.isbn = book.isbn
		WHERE customer_id = $customerId
		ORDER BY col.isbn ASC;`,
		[customerId]
	);
	return result.map(marshallCustomerOrderLineDates);
};

/**
 * Retrieves a history entries for each time a particular customer order line had been placed with a supplier.
 * TODO: history is the best I cound come up with in terms of nomenclature, maybe revisit
 */
export async function getCustomerOrderLineHistory(db: DB, lineId: number): Promise<CustomerOrderLineHistory[]> {
	const query = `
		SELECT
			supplier_order_id AS supplierOrderId,
			placed
		FROM customer_order_line_supplier_order
		WHERE customer_order_line_id = ?
		ORDER BY placed DESC
	`;
	const res = await db.execO<CustomerOrderLineHistory>(query, [lineId]);
	return res.map(({ placed, ...rest }) => ({ ...rest, placed: new Date(placed) }));
}

/**
 * Retrieves customer details from the database for a specific customer ID.
 *
 * @param {DB} db - The database connection instance
 * @param {number} customerId - The unique identifier of the customer
 * @returns {Promise<Customer[]>} A promise that resolves to an array of customer details
 *                               containing id, fullname, deposit, and email information
 *
 * TODO: it would probably make more sense to return Promise<Customer | undefined> (instead of a list)
 */
export const getCustomerDetails = async (db: DB, customerId: number): Promise<Customer[]> => {
	const result = await db.execO<Omit<Customer, "updatedAt"> & { updated_at: number }>(
		"SELECT id, display_id AS displayId, fullname, deposit, email, updated_at FROM customer WHERE id = $customerId;",
		[customerId]
	);

	return result.map(({ updated_at, ...row }) => ({ ...row, updatedAt: new Date(updated_at) }));
};

/**
 * Converts a database customer order line numeric dates to Date objects for ease of use in the UI
 *
 * @param {DBCustomerOrderLine} line - The database representation of a customer order line dates
 * @returns {CustomerOrderLine} The application representation of a customer order line with proper date objects
 *
 * @example
 * const dbLine = {
 *   created: 1638316800000,
 *   placed: 1638403200000,
 *   supplierOrderIds: "1,2,3"
 * };
 * const appLine = marshallCustomerOrderLine(dbLine);
 * Returns: { created: Date(...), placed: Date(...) }
 */
export const marshallCustomerOrderLineDates = (line: DBCustomerOrderLine): CustomerOrderLine => {
	return {
		...line,
		created: new Date(line.created),
		placed: line.placed ? new Date(line.placed) : undefined,
		received: line.received ? new Date(line.received) : undefined,
		collected: line.collected ? new Date(line.collected) : undefined
	};
};

/**
 * Adds multiple books that associate with a specific customer's order a
 * updates the customer's last modified timestamp.
 *
 * @param {DB} db - The database connection instance
 * @param {number} customerId - The unique identifier of the customer
 * @param {string[]} bookIsbns - Array of book ISBNs to add
 * @returns {Promise<void>} A promise that resolves when both operations complete successfully
 * @throws {Error} If the database transaction fails
 * @see apps/e2e/helpers/cr-sqlite.ts:addBooksToCustomer

 */
export const addBooksToCustomer = async (db: DB, customerId: number, bookIsbns: string[]): Promise<void> => {
	const timestamp = Date.now();
	const params = bookIsbns.map((isbn) => [customerId, isbn, timestamp]).flat();
	const sql = `
     INSERT INTO customer_order_lines (customer_id, isbn, created)
     VALUES ${multiplyString("(?,?,?)", bookIsbns.length)}
	`;

	await db.exec(sql, params);
};

/** Checks if there's another customer with the same display ID */
export const isDisplayIdUnique = async (db: DB, customer: Customer) => {
	const [res] = await db.execO<{ count: number }>("SELECT COUNT(*) as count FROM customer WHERE display_id = ? AND id != ?", [
		customer.displayId,
		customer.id
	]);
	return !res.count;
};

export const getCustomerDisplayIdSeq = async (db: DB): Promise<number> => {
	const [result] = await db.execO<{ nextId: number }>(
		"SELECT COALESCE(MAX(CAST(display_id AS INTEGER)) + 1, 1) as nextId FROM customer WHERE CAST(display_id AS INTEGER) < 10000;"
	);
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
 * Marks customer order lines as collected when customer order lines are picked up.
 * For each supplied ISBN, it updates the earliest unfulfilled customer order line
 * (that has been received but not collected) with the current timestamp as collected date.
 *
 * @param {DB} db - The database connection instance
 * @param {ids[]} ids - Array of supplier order line ids that have been collected
 * @returns {Promise<void>} A promise that resolves when all relevant customer orders are marked as collected
 */

export const markCustomerOrderAsCollected = async (db: DB, ids: number[]): Promise<void> => {
	if (!ids.length) return;
	return db.tx(async (txDb) => {
		const timestamp = Date.now();
		const placeholders = multiplyString("?", ids.length);
		await txDb.exec(
			`
		 UPDATE customer_order_lines
            SET collected = ?
            WHERE id IN (${placeholders})
            AND collected IS NULL AND received IS NOT NULL
            ;`,
			[timestamp, ...ids]
		);
	});
};

export const markCustomerOrderLineAsCollected = async (db: DB, lineId: number): Promise<void> => {
	const timestamp = Date.now();
	await db.exec(
		`
		UPDATE customer_order_lines
		SET collected = ?
		WHERE id = ?
		`,
		[timestamp, lineId]
	);
};
