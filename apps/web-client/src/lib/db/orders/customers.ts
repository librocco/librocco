import { browser } from "$app/environment";
import { type DB } from "./types";

type Customer = {
	id?: number;
	fullname?: string;
	email?: string;
	deposit?: number;
};
type CustomerOrderLine = { id: number; isbn: string; quantity: number };
type Book = { isbn: string; quantity: number };

export async function getAllCustomers(db: DB): Promise<Customer[]> {
	const result = await db.execO<Customer>("SELECT id, fullname, email, deposit FROM customer ORDER BY id ASC;");
	return result;
}

export async function upsertCustomer(db: DB, customer: Customer) {
	if (!customer.id) {
		throw new Error("Customer must have an id");
	}

	await db.execO(
		`INSERT INTO customer (id, fullname, email, deposit)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           fullname = ?,
           email = ?,
           deposit = ?;`,
		[customer.id, customer.fullname, customer.email, customer.deposit]
	);
}

export const getCustomerBooks = async (db: DB, customerId: number): Promise<CustomerOrderLine[]> => {
	const result = await db.execO<CustomerOrderLine>(
		"SELECT id, isbn, quantity FROM customer_order_lines WHERE customer_id = $customerId ORDER BY id ASC;",
		[customerId]
	);
	return result;
};

export const addBooksToCustomer = async (db: DB, customerId: number, books: Book[]) => {
	// books is a list of { isbn, quantity }
	const params = books.map((book) => [customerId, book.isbn, book.quantity]).flat();
	const sql =
		`INSERT INTO customer_order_lines (customer_id, isbn, quantity)
    VALUES ` + multiplyString("(?,?,?)", books.length);
	await db.execO(sql, params);
};

// Example: multiplyString("foo", 5) → "foo, foo, foo, foo, foo"
const multiplyString = (str: string, n: number) => Array(n).fill(str).join(", ");

export const removeBooksFromCustomer = async (db: DB, customerId: number, bookIds: number[]) => {
	const sql = `DELETE FROM customer_order_lines WHERE customer_id = ? AND id IN (${multiplyString("?", bookIds.length)})`;
	const params = [customerId, ...bookIds];
	await db.execO(sql, params);
};

if (browser) {
	window["getAllCustomers"] = getAllCustomers;
	window["upsertCustomer"] = upsertCustomer;
	window["getCustomerBooks"] = getCustomerBooks;
	window["addBooksToCustomer"] = addBooksToCustomer;
	window["removeBooksFromCustomer"] = removeBooksFromCustomer;
}
