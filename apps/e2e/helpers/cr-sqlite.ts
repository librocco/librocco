import type { DB } from "@vlcn.io/crsqlite-wasm";

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

	const stmt = "INSERT INTO note (id, display_name, warehouse_id) VALUES (?, ?, ?)";

	return db.exec(stmt, [noteId, displayName, warehouseId]);
}

export function createOutboundNote(db: DB, noteId: number): Promise<void> {
	const stmt = "INSERT INTO note (id, display_name) VALUES (?, ?)";

	const displayName = "New Note";
	return db.exec(stmt, [noteId, displayName]);
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

	updateFields.push("updated_at = (strftime('%s', 'now') * 1000)");

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

	const keys = ["note_id", "isbn", "quantity"];
	const values = [noteId, isbn, quantity];

	if (warehouseId) {
		keys.push("warehouse_id");
		values.push(warehouseId);
	}

	const insertOrUpdateTxnQuery = `
		INSERT INTO book_transaction (${keys.join(", ")})
		VALUES (${keys.map(() => "?").join(", ")})
		ON CONFLICT(isbn, note_id, warehouse_id) DO UPDATE SET
			quantity = book_transaction.quantity + excluded.quantity,
			updated_at = (strftime('%s', 'now') * 1000)
	`;

	await db.exec(insertOrUpdateTxnQuery, values);
}

export type NoteCustomItem = { id: number; title: string; price: number };

export async function upsertNoteCustomItem(db: DB, params: readonly [noteId: number, item: NoteCustomItem]): Promise<void> {
	const [noteId, item] = params;
	const { id, title, price } = item;

	const query = `
		INSERT INTO custom_item(id, note_id, title, price)
		VALUES(?, ?, ?, ?)
		ON CONFLICT(id, note_id) DO UPDATE SET
			title = excluded.title,
			price = excluded.price
	`;

	await db.exec(query, [id, noteId, title, price]);
}

export async function commitNote(db: DB, id: number): Promise<void> {
	return db.exec("UPDATE note SET committed = 1, committed_at = (strftime('%s', 'now') * 1000) WHERE id = ?", [id]);
}
