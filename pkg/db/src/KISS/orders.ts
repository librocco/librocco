// Look, mum! No imports!

type SQLite3 = any; // I cheated, I know!
type customer = {
	id?: number;
	fullname?: string;
	email?: string;
	deposit?: number;
};
type CustomerOrderLine = [number, string, number];
type Book = { isbn: string; quantity: number };

export async function getAllCustomers(db: SQLite3): Promise<customer[]> {
	type row = [number, string, string, number];
	const result = await db.exec({
		sql: "SELECT id, fullname, email, deposit FROM customer ORDER BY id ASC;",
		returnValue: "resultRows"
	});
	return result.map((row: row) => {
		return {
			id: row[0],
			fullname: row[1],
			email: row[2],
			deposit: row[3]
		};
	});
}

export async function upsertCustomer(db: SQLite3, customer: customer) {
	if (!customer.id) {
		throw new Error("Customer must have an id");
	}
	const params = {
		$id: customer.id,
		$fullname: customer.fullname,
		$email: customer.email,
		$deposit: customer.deposit
	};

	await db.exec({
		sql: `INSERT INTO customer (id, fullname, email, deposit)
        VALUES ($id, $fullname, $email, $deposit)
        ON CONFLICT(id) DO UPDATE SET
          fullname = $fullname,
          email = $email,
          deposit = $deposit;`,
		bind: params,
		returnValue: "resultRows"
	});
}

export const getCustomerBooks = async (db: SQLite3, customerId: number) => {
	const result = await db.exec({
		sql: "SELECT id, isbn, quantity FROM customer_order_lines WHERE customer_id = $customerId ORDER BY id ASC;",
		bind: { $customerId: customerId },
		returnValue: "resultRows"
	});
	return result.map((row: CustomerOrderLine) => {
		return {
			id: row[0],
			isbn: row[1],
			quantity: row[2]
		};
	});
	return [];
};
export const addBooksToCustomer = async (db: SQLite3, customerId: number, books: Book[]) => {
	// books is a list of { isbn, quantity }
	const params = books.map((book) => [customerId, book.isbn, book.quantity]).flat();
	const sql =
		`INSERT INTO customer_order_lines (customer_id, isbn, quantity)
    VALUES ` + multiplyString("(?,?,?)", books.length);
	await db.exec({
		sql: sql,
		bind: params,
		returnValue: "resultRows"
	});
};

// Example: multiplyString("foo", 5) → "foo, foo, foo, foo, foo"
const multiplyString = (str: string, n: number) => Array(n).fill(str).join(", ");

export const removeBooksFromCustomer = async (db: SQLite3, customerId: number, bookIds: number[]) => {
	const sql = `DELETE FROM customer_order_lines WHERE customer_id = ? AND id IN (${multiplyString("?", bookIds.length)})`;
	const params = [customerId, ...bookIds];
	await db.exec({
		sql: sql,
		bind: params
	});
};
