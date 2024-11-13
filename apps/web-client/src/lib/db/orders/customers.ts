import type { DB, Customer, DBCustomerOrderLine, CustomerOrderLine, BookLine, SupplierOrderLine } from "./types";

export async function getAllCustomers(db: DB): Promise<Customer[]> {
	const result = await db.execO<Customer>("SELECT id, fullname, email, deposit FROM customer ORDER BY id ASC;");
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

export const getCustomerBooks = async (db: DB, customerId: number): Promise<CustomerOrderLine[]> => {
	const result = await db.execO<DBCustomerOrderLine>(
		`SELECT customer_order_lines.id, isbn, quantity, created, placed, received, collected, GROUP_CONCAT(supplier_order_id) as supplierOrderIds
		FROM customer_order_lines
		LEFT JOIN customer_supplier_order ON customer_order_lines.id = customer_supplier_order.customer_order_line_id
		WHERE customer_id = $customerId
		GROUP BY customer_order_lines.id, isbn, quantity, created, placed, received, collected
		ORDER BY customer_order_lines.id ASC;`,
		[customerId]
	);
	return result.map(marshallCustomerOrderLine);
};

export const getCustomerDetails = async (db: DB, customerId: number): Promise<Customer[]> => {
	const result = await db.execO<Customer>("SELECT id, fullname, deposit, email FROM customer WHERE id = $customerId;", [customerId]);

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

export const addBooksToCustomer = async (db: DB, customerId: number, books: BookLine[]) => {
	// books is a list of { isbn, quantity }
	const params = books.map((book) => [customerId, book.isbn, book.quantity]).flat();
	const sql =
		`INSERT INTO customer_order_lines (customer_id, isbn, quantity)
    VALUES ` + multiplyString("(?,?,?)", books.length);
	await db.exec(sql, params);
};

// Example: multiplyString("foo", 5) → "foo, foo, foo, foo, foo"
const multiplyString = (str: string, n: number) => Array(n).fill(str).join(", ");

export const removeBooksFromCustomer = async (db: DB, customerId: number, bookIds: number[]) => {
	const sql = `DELETE FROM customer_order_lines WHERE customer_id = ? AND id IN (${multiplyString("?", bookIds.length)})`;
	const params = [customerId, ...bookIds];
	await db.exec(sql, params);
};

export const updateOrderLineQuantity = async (db: DB, bookId: number, quantity: number) => {
	const sql = `UPDATE customer_order_lines SET quantity = ? WHERE id = ?`;
	const params = [quantity, bookId];
	await db.exec(sql, params);
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
