import type { DB } from "@vlcn.io/crsqlite-wasm";
import { Customer } from "./types";

// #region books

export type BookData = {
	isbn: string;
	title?: string;
	price?: number;
	year?: string;
	authors?: string;
	publisher?: string;
	editedBy?: string;
	outOfPrint?: boolean;
	category?: string;
};

export async function upsertBook(db: DB, book: BookData) {
	await db.exec(
		`INSERT INTO book (isbn, title, authors, publisher, price, year, edited_by, out_of_print, category)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(isbn) DO UPDATE SET
            title = COALESCE(?, title),
            authors = COALESCE(?, authors),
            publisher = COALESCE(?, publisher),
            price = COALESCE(?, price),
            year = COALESCE(?, year),
            edited_by = COALESCE(?, edited_by),
            out_of_print = COALESCE(?, out_of_print),
            category = COALESCE(?, category);`,
		[
			book.isbn,
			book.title,
			book.authors,
			book.publisher,
			book.price,
			book.year,
			book.editedBy,
			Number(book.outOfPrint),
			book.category,
			book.title,
			book.authors,
			book.publisher,
			book.price,
			book.year,
			book.editedBy,
			Number(book.outOfPrint),
			book.category
		]
	);
}

// #region warehouse

export type Warehouse = {
	id: number;
	displayName?: string | null;
	discount?: number | null;
};

export function upsertWarehouse(db: DB, data: Warehouse): Promise<void> {
	if (!data.id) {
		throw new Error("Warehouse must have an id");
	}

	return db.tx(async (txDb) => {
		const { id, displayName = null, discount = null } = data;

		const query = `
        INSERT INTO warehouse (id, display_name, discount)
        VALUES (?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            display_name = COALESCE(?, display_name),
            discount = COALESCE(?, discount);
    `;
		await txDb.exec(query, [id, displayName, discount, displayName, discount]);
	});
}

// #region notes

export function createInboundNote(db: DB, params: { id: number; warehouseId: number; displayName?: string }): Promise<void> {
	const { warehouseId, id: noteId, displayName = "New Note" } = params;

	const timestamp = Date.now();
	const stmt = "INSERT INTO note (id, display_name, warehouse_id, updated_at) VALUES (?, ?, ?, ?)";

	return db.exec(stmt, [noteId, displayName, warehouseId, timestamp]);
}

export function createOutboundNote(db: DB, params: { id: number; displayName?: string }): Promise<void> {
	const { id: noteId, displayName = "New Note" } = params;

	const timestamp = Date.now();
	const stmt = "INSERT INTO note (id, display_name, updated_at) VALUES (?, ?, ?)";

	return db.exec(stmt, [noteId, displayName, timestamp]);
}

export async function updateNote(db: DB, payload: { id: number; displayName?: string; defaultWarehouse?: number }): Promise<void> {
	const { id, displayName, defaultWarehouse } = payload;

	const updateFields = [];
	const updateValues: (string | number)[] = [];

	if (displayName !== undefined) {
		updateFields.push("display_name = ?");
		updateValues.push(displayName);
	}

	if (defaultWarehouse !== undefined) {
		updateFields.push("default_warehouse = ?");
		updateValues.push(defaultWarehouse);
	}

	if (updateFields.length === 0) {
		return;
	}

	updateFields.push("updated_at = ?");
	updateValues.push(Date.now());

	const updateQuery = `
		UPDATE note
		SET ${updateFields.join(", ")}
		WHERE id = ?
	`;

	updateValues.push(id);

	return db.exec(updateQuery, updateValues);
}

// #region note-txns

type VolumeStock = {
	isbn: string;
	quantity: number;
	warehouseId?: number;
};

export async function addVolumesToNote(db: DB, params: readonly [noteId: number, volume: VolumeStock]): Promise<void> {
	const [noteId, volume] = params;

	const { isbn, quantity, warehouseId } = volume;

	const timestamp = Date.now();

	const keys = ["note_id", "isbn", "quantity", "updated_at"];
	const values = [noteId, isbn, quantity, timestamp];

	if (warehouseId) {
		keys.push("warehouse_id");
		values.push(warehouseId);
	}

	const insertOrUpdateTxnQuery = `
		INSERT INTO book_transaction (${keys.join(", ")})
		VALUES (${keys.map(() => "?").join(", ")})
		ON CONFLICT(isbn, note_id, warehouse_id) DO UPDATE SET
			quantity = book_transaction.quantity + excluded.quantity,
			updated_at = excluded.updated_at
	`;

	await db.tx(async (txDb) => {
		await txDb.exec(insertOrUpdateTxnQuery, values);
		await txDb.exec(`UPDATE note SET updated_at = ? WHERE id = ?`, [timestamp, noteId]);
	});
}

export type NoteCustomItem = { id: number; title: string; price: number };

export async function upsertNoteCustomItem(db: DB, params: readonly [noteId: number, item: NoteCustomItem]): Promise<void> {
	const [noteId, item] = params;
	const { id, title, price } = item;

	const timestamp = Date.now();

	const query = `
		INSERT INTO custom_item(id, note_id, title, price, updated_at)
		VALUES(?, ?, ?, ?, ?)
		ON CONFLICT(id, note_id) DO UPDATE SET
			title = excluded.title,
			price = excluded.price,
			updated_at = excluded.updated_at
	`;

	await db.exec(query, [id, noteId, title, price, timestamp]);
}

export async function commitNote(db: DB, id: number): Promise<void> {
	return db.exec("UPDATE note SET committed = 1, committed_at = ? WHERE id = ?", [Date.now(), id]);
}

// #region customerOrders

export async function upsertCustomer(db: DB, customer: Customer) {
	if (!customer.id) {
		throw new Error("Customer must have an id");
	}

	const timestamp = Date.now();
	await db.exec(
		`INSERT INTO customer (id, fullname, email, deposit, updated_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           fullname = COALESCE(?, fullname),
           email = COALESCE(?, email),
           updated_at = ?,
           deposit = COALESCE(?, deposit);`,
		[
			customer.id,
			customer.fullname ?? null,
			customer.email ?? null,
			customer.deposit ?? null,
			timestamp,
			customer.fullname ?? null,
			customer.email ?? null,
			timestamp,
			customer.deposit ?? null
		]
	);
}

export const addBooksToCustomer = async (db: DB, params: { customerId: number; bookIsbns: string[] }): Promise<void> => {
	const multiplyString = (str: string, n: number) => Array(n).fill(str).join(", ");
	const { customerId, bookIsbns } = params;
	const sqlParams = bookIsbns.map((isbn) => [customerId, isbn]).flat();
	const sql = `
     INSERT INTO customer_order_lines (customer_id, isbn)
     VALUES ${multiplyString("(?,?)", bookIsbns.length)} RETURNING customer_id;`;

	const id = await db.exec(sql, sqlParams);
	console.log({ id });
};

// #endregion customerOrders
