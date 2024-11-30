import type { DB, Customer, DBCustomerOrderLine, CustomerOrderLine, BookLine, SupplierOrderLine } from "./types";

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
 * Adds multiple books to a customer's order and updates the customer's last modified timestamp.
 *
 * @param {DB} db - The database connection instance
 * @param {number} customerId - The unique identifier of the customer
 * @param {BookLine[]} books - Array of books to add, each containing ISBN and quantity
 * @returns {Promise<void>} A promise that resolves when both operations complete successfully
 * @throws {Error} If the database transaction fails
 */
export const addBooksToCustomer = async (db: DB, customerId: number, books: BookLine[]): Promise<void> => {
	// books is a list of { isbn }
	const params = books.map((book) => [customerId, book.isbn, book.quantity]).flat();
	const sql = `
     INSERT INTO customer_order_lines (customer_id, isbn, quantity)
     VALUES ${multiplyString("(?,?,?)", books.length)};`;
	const updateSql = ` UPDATE customer SET updatedAt = (strftime('%s', 'now') * 1000) WHERE id = ${customerId};
 `;
	return db.tx(async (txDb) => {
		await txDb.exec(sql, params);
		await txDb.exec(updateSql);
	});
};

// Example: multiplyString("foo", 5) → "foo, foo, foo, foo, foo"
const multiplyString = (str: string, n: number) => Array(n).fill(str).join(", ");

/**
 * Removes specified books from a customer's order.
 *
 * @param {DB} db - The database connection instance
 * @param {number} customerId - The unique identifier of the customer
 * @param {number[]} bookIds - Array of book order line IDs to remove
 * @returns {Promise<void>} A promise that resolves when the deletion is complete
 * @throws {Error} If the database operation fails
 */
export const removeBooksFromCustomer = async (db: DB, customerId: number, bookIds: number[]): Promise<void> => {
	const sql = `DELETE FROM customer_order_lines WHERE customer_id = ? AND id IN (${multiplyString("?", bookIds.length)})`;
	const params = [customerId, ...bookIds];

	const updateSql = ` UPDATE customer SET updatedAt = (strftime('%s', 'now') * 1000) WHERE id = ${customerId};`;
	return db.tx(async (txDb) => {
		await txDb.exec(sql, params);
		await txDb.exec(updateSql);
	});
};

export const markCustomerOrderAsReceived = async (db: DB, supplierOrderLines: SupplierOrderLine[]) => {
	if (!supplierOrderLines.length) return;
	return db.tx(async (txDb) => {
		const isbns = supplierOrderLines.map((line) => line.isbn);
		const placeholders = multiplyString("?", supplierOrderLines.length);
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
