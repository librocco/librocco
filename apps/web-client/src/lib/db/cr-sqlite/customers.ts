/**
 * @fileoverview Customer order management system
 *
 * Customer Orders Overview:
 * - A customer order in the DB is some customer information (email, id, deposit)
 * - Conceptually, customer orders are implicit groupings of order lines, associated with the customer information
 * - Order lines are created in "pending" state and transition through states based on timestamps
 *
 * Order Line States:
 * - Pending: Has created timestamp (inital state)
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

import {
	type DB,
	type Customer,
	type DBCustomerOrderLine,
	type CustomerOrderLine,
	type DBCustomer,
	type DBCustomerOrderListItem,
	type CustomerOrderListItem,
	type CustomerOrderLineHistory
} from "./types";

/**
 * Creates a new customer or updates an existing one.
 * Uses customer ID as the unique identifier for upsert operations.
 * Updates the customer's lastModified timestamp automatically.
 * All fields except ID are optional and will only be updated if provided.
 *
 * @param {DB} db - Database connection
 * @param {Customer} customer - Customer data
 * @throws {Error} If customer ID is not provided
 */
export async function upsertCustomer(db: DB, customer: Omit<Customer, "updatedAt">) {
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
export const getCustomerDetails = async (db: DB, customerId: number): Promise<Customer> => {
	const [result] = await db.execO<DBCustomer>(
		`
			SELECT
				id,
				display_id AS displayId,
				COALESCE(fullname, 'N/A') AS fullname,
				COALESCE(deposit, 0) AS deposit,

				-- NOTE: we're not coalescing email as we need it to be null if not set
				-- so that the form can treat it as (undefined) optional field and not an (existing) invalid email
				email,
				updated_at
			FROM customer
			WHERE id = ?
		`,
		[customerId]
	);

	if (!result) return undefined;

	return unmarshallCustomerOrder(result);
};

const unmarshallCustomerOrder = ({ updated_at, ...customer }: DBCustomer): Customer => ({ ...customer, updatedAt: new Date(updated_at) });

/**
 * Retrieves all customer orders from the database.
 * Returns full customer information, along with order status.
 *
 * @param {DB} db - Database connection
 * @returns {Promise<CustomerOrderListItem[]>} Array of customers
 */
export async function getCustomerOrderList(db: DB): Promise<CustomerOrderListItem[]> {
	const orderLineStatusQuery = `
		SELECT
			customer_id,
			CASE
				WHEN collected IS NOT NULL THEN 3
				WHEN received IS NOT NULL THEN 2
				WHEN placed IS NOT NULL THEN 1
				ELSE 0
			END AS status_ord
		FROM customer_order_lines
	`;

	const query = `
		SELECT
			id,
			display_id AS displayId,
			COALESCE(fullname, 'N/A') AS fullname,
			COALESCE(deposit, 0) AS deposit,
			COALESCE(email, 'N/A') AS email,
			updated_at,
			MIN(col.status_ord) as status
		FROM customer
		LEFT JOIN (${orderLineStatusQuery}) AS col ON customer.id = col.customer_id
		GROUP BY id
		ORDER BY id ASC -- TODO: check prefered ordering
	`;

	const res = await db.execO<DBCustomerOrderListItem>(query);
	return res.map(unmarshallCustomerOrderListItem);
}

const unmarshallCustomerOrderListItem = ({ updated_at, status, ...customer }: DBCustomerOrderListItem): CustomerOrderListItem => ({
	...customer,
	updatedAt: new Date(updated_at),
	completed: status === 3
});

/**
 * Adds multiple books that associate with a specific customer's order a
 * updates the customer's last modified timestamp.
 *
 * @param {DB} db - The database connection instance
 * @param {number} customerId - The unique identifier of the customer
 * @param {string[]} bookIsbns - Array of book ISBNs to add
 * @returns {Promise<void>} A promise that resolves when both operations complete successfully
 * @throws {Error} If the database transaction fails
 */
export const addBooksToCustomer = async (db: DB, customerId: number, bookIsbns: string[]): Promise<void> => {
	return await db.tx(async (db) => {
		const timestamp = Date.now();
		const params = bookIsbns.map((isbn) => [customerId, isbn, timestamp]).flat();

		// Insert book lines
		await db.exec(
			`INSERT INTO customer_order_lines (customer_id, isbn, created) VALUES ${multiplyString("(?,?,?)", bookIsbns.length)}`,
			params
		);

		// Update customer timestamp
		await db.exec("UPDATE customer SET updated_at = ? WHERE id = ?", [timestamp, customerId]);
	});
};

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
	return await db.tx(async (db) => {
		await db.exec(`DELETE FROM customer_order_lines WHERE customer_id = ? AND id IN (${multiplyString("?", bookIds.length)})`, [
			customerId,
			...bookIds
		]);

		// Update customer timestamp
		const timestamp = Date.now();
		await db.exec("UPDATE customer SET updated_at = ? WHERE id = ?", [timestamp, customerId]);
	});
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
			COALESCE(book.authors, 'N/A') AS authors,
			CASE
				WHEN collected IS NOT NULL THEN 3
				WHEN received IS NOT NULL THEN 2
				WHEN placed IS NOT NULL THEN 1
				ELSE 0
			END AS status
		FROM customer_order_lines col
		LEFT JOIN book ON col.isbn = book.isbn
		WHERE customer_id = ?
		ORDER BY col.isbn ASC
		`,
		[customerId]
	);
	return result.map(unmarshalCustomerOrderLine);
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
export const unmarshalCustomerOrderLine = (line: DBCustomerOrderLine): CustomerOrderLine => {
	return {
		...line,
		created: new Date(line.created),
		placed: line.placed ? new Date(line.placed) : undefined,
		received: line.received ? new Date(line.received) : undefined,
		collected: line.collected ? new Date(line.collected) : undefined
	};
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

// Example: multiplyString("foo", 5) → "foo, foo, foo, foo, foo"
export const multiplyString = (str: string, n: number) => Array(n).fill(str).join(", ");

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
            ;`,
			[timestamp, ...ids]
		);
	});
};

export const markCustomerOrderLinesAsCollected = async (db: DB, ids: number[]): Promise<void> => {
	if (!ids.length) return;

	const timestamp = Date.now();
	await db.exec(
		`
			UPDATE customer_order_lines
			SET collected = ?
			WHERE id IN (${multiplyString("?", ids.length)})
		`,
		[timestamp, ...ids]
	);
};
