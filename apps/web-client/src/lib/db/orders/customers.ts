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
 *   - quantity: Number of copies (currently non-editable after creation and will be removed)
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

export async function getAllCustomers(db: DB): Promise<Customer[]> {
	const result = await db.execO<Customer>("SELECT id, fullname, email, updatedAt, deposit FROM customer ORDER BY id ASC;");
	return result;
}

export async function upsertCustomer(db: DB, customer: Customer) {
	if (!customer.id) {
		throw new Error("Customer must have an id");
	}
	await db.exec(
		`INSERT INTO customer (id, fullname, email, deposit)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           fullname = COALESCE(?, fullname),
           email = COALESCE(?, email),
           updatedAt = (strftime('%s', 'now') * 1000),
           deposit = COALESCE(?, deposit);`,
		[
			customer.id,
			customer.fullname ?? null,
			customer.email ?? null,
			customer.deposit ?? null,
			customer.fullname ?? null,
			customer.email ?? null,
			customer.deposit ?? null
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
		`SELECT customer_order_lines.id, customer_id, isbn, quantity, created, placed, received, collected
		FROM customer_order_lines`
	);

	return result;
};

export const getCustomerBooks = async (db: DB, customerId: number): Promise<CustomerOrderLine[]> => {
	const result = await db.execO<DBCustomerOrderLine>(
		`SELECT customer_order_lines.id, isbn, quantity, customer_id, created, placed, received, collected, GROUP_CONCAT(supplier_order_id) as supplierOrderIds
		FROM customer_order_lines
		LEFT JOIN customer_supplier_order ON customer_order_lines.id = customer_supplier_order.customer_order_line_id
		WHERE customer_id = $customerId
		GROUP BY customer_order_lines.id, isbn, quantity, created, placed, received, collected
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
		supplierOrderIds: line.supplierOrderIds ? line.supplierOrderIds.split(",").map(Number) : []
	};
};

/**
 * Adds multiple books that associate with a specific customer's order a
 * updates the customer's last modified timestamp.
 *
 * @param {DB} db - The database connection instance
 * @param {number} customerId - The unique identifier of the customer
 * @param {BookLine[]} books - Array of books to add, each containing ISBN and quantity
 * @returns {Promise<void>} A promise that resolves when both operations complete successfully
 * @throws {Error} If the database transaction fails
 */
export const addBooksToCustomer = async (db: DB, customerId: number, books: BookLine[]): Promise<void> => {
	/**
	 * @TODO the customerId is persisted with a decimal point,
	 * converting it to a string here resulted in the book not getting persisted
	 */
	const params = books.map((book) => [customerId, book.isbn, book.quantity]).flat();
	const sql = `
     INSERT INTO customer_order_lines (customer_id, isbn, quantity)
     VALUES ${multiplyString("(?,?,?)", books.length)};`;
	// const updateSql = ` UPDATE customer SET updatedAt = (strftime('%s', 'now') * 1000) WHERE id = ${customerId};
	// `;
	return db.tx(async (txDb) => {
		await txDb.exec(sql, params);
		// await txDb.exec(updateSql);
	});
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

	// const updateSql = ` UPDATE customer SET updatedAt = (strftime('%s', 'now') * 1000) WHERE id = ${customerId};`;
	return db.tx(async (txDb) => {
		await txDb.exec(sql, params);
		// await txDb.exec(updateSql);
	});
};

/**
 * Marks customer order lines as received when supplier order lines are fulfilled.
 * For each supplied ISBN, it updates the earliest unfulfilled customer order line
 * (that has been placed but not received) with the current timestamp as received date.
 *
 * @param {DB} db - The database connection instance
 * @param {SupplierOrderLine[]} supplierOrderLines - Array of supplier order lines that have been received
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
 *   { isbn: "123456789", quantity: 2 },
 *   { isbn: "987654321", quantity: 1 }
 * ]);
 */

export const markCustomerOrderAsReceived = async (db: DB, isbns: string[]) => {
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
