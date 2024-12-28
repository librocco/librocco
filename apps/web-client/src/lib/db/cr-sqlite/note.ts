import type {
	DB,
	InboundNoteListItem,
	VolumeStock,
	NoteEntriesItem,
	OutboundNoteListItem,
	OutOfStockTransaction,
	ReceiptData,
	ReceiptItem,
	NoteCustomItem
} from "./types";

import { NoWarehouseSelectedError, OutOfStockError } from "./errors";

import { getStock } from "./stock";

export async function getNoteIdSeq(db: DB) {
	const query = `SELECT COALESCE(MAX(id), 0) + 1 AS nextId FROM note;`;
	const [result] = await db.execO<{ nextId: number }>(query);
	return result.nextId;
}

const getSeqName = async (db: DB, kind: "inbound" | "outbound") => {
	const sequenceQuery = `
			SELECT display_name AS displayName FROM note
			WHERE displayName LIKE 'New Note%'
			AND warehouse_id ${kind === "outbound" ? "IS NULL" : "IS NOT NULL"}
			ORDER BY displayName DESC
			LIMIT 1;
`;
	const result = await db.execO<{ displayName?: string }>(sequenceQuery);
	const displayName = result[0]?.displayName;

	if (!displayName) {
		return "New Note";
	}

	if (displayName === "New Note") {
		return "New Note (2)";
	}

	const maxSequence = Number(displayName.replace("New Note", "").replace("(", "").replace(")", "").trim()) + 1;

	return `New Note (${maxSequence})`;
};

export function createInboundNote(db: DB, warehouseId: number, noteId: number): Promise<void> {
	const timestamp = Date.now();
	const stmt = "INSERT INTO note (id, display_name, warehouse_id, updated_at) VALUES (?, ?, ?, ?)";

	return db.tx(async (txDb) => {
		const displayName = await getSeqName(txDb, "inbound");
		await txDb.exec(stmt, [noteId, displayName, warehouseId, timestamp]);
	});
}

export function createOutboundNote(db: DB, noteId: number): Promise<void> {
	const timestamp = Date.now();
	const stmt = "INSERT INTO note (id, display_name, updated_at) VALUES (?, ?, ?)";

	return db.tx(async (txDb) => {
		const displayName = await getSeqName(txDb, "outbound");
		await txDb.exec(stmt, [noteId, displayName, timestamp]);
	});
}

export async function getAllInboundNotes(db: DB): Promise<InboundNoteListItem[]> {
	const query = `

		SELECT
			note.id,
			note.display_name AS displayName,
			warehouse.display_name AS warehouseName,
			note.updated_at,
			COALESCE(SUM(book_transaction.quantity), 0) AS totalBooks
		FROM note
		INNER JOIN warehouse ON note.warehouse_id = warehouse.id
		LEFT JOIN book_transaction ON note.id = book_transaction.note_id
		WHERE note.committed = 0
		GROUP BY note.id
	`;

	const res = await db.execO<{ id: number; displayName: string; warehouseName: string; updated_at: number; totalBooks: number }>(query);

	// TODO: update total books when we add note volume stock functionality
	return res.map(({ updated_at, ...el }) => ({ ...el, updatedAt: new Date(updated_at) }));
}

export async function getAllOutboundNotes(db: DB): Promise<OutboundNoteListItem[]> {
	const query = `

		SELECT
			note.id,
			note.display_name AS displayName,
			note.updated_at,
			COALESCE(SUM(book_transaction.quantity), 0) AS totalBooks
		FROM note
		LEFT JOIN book_transaction ON note.id = book_transaction.note_id
		WHERE note.warehouse_id IS NULL
		AND note.committed = 0
		GROUP BY note.id

	`;

	const res = await db.execO<{ id: number; displayName: string; updated_at: number; totalBooks: number }>(query);

	// TODO: update total books when we add note volume stock functionality
	return res.map(({ updated_at, ...el }) => ({ ...el, updatedAt: new Date(updated_at) }));
}

type GetNoteResponse = {
	id: number;
	displayName: string;
	/** for inbound notes, undefined otherwise */
	warehouseId?: number;
	/** for inbound notes, undefined otherwise */
	warehouseName?: string;
	/** for outbound notes, undefined otherwise */
	defaultWarehouse?: number;
	// if note has warehouseId, this should be: "inbound"
	// if note is a reconciliation note, this should be: "inbound"
	// in all other cases, this should be: "outbound"
	noteType: string;
	updatedAt: Date;
	committed: boolean;
	committedAt?: Date;
	isReconciliationNote: boolean;
};

export async function getNoteById(db: DB, id: number): Promise<GetNoteResponse | undefined> {
	const query = `
		SELECT
			note.id,
			note.display_name AS displayName,
			note.warehouse_id AS warehouseId,
			warehouse.display_name AS warehouseName,
			note.default_warehouse AS defaultWarehouse,
			note.updated_at,
			note.committed,
			note.committed_at,
			note.is_reconciliation_note
		FROM note
		LEFT JOIN warehouse ON note.warehouse_id = warehouse.id
		WHERE note.id = ?
	`;

	const result = await db.execO<{
		id: number;
		displayName: string;
		warehouseId?: number;
		warehouseName?: string;
		defaultWarehouse?: number;
		is_reconciliation_note: number;
		updated_at: number;
		committed: number;
		committed_at: number;
	}>(query, [id]);

	if (result.length === 0) {
		return undefined;
	}

	const { updated_at, committed_at, committed, is_reconciliation_note, ...note } = result[0];

	const noteType = note.warehouseId || is_reconciliation_note ? "inbound" : "outbound";

	return {
		...note,
		noteType,
		updatedAt: new Date(updated_at),
		committed: Boolean(committed),
		committedAt: committed_at ? new Date(committed_at) : undefined,
		isReconciliationNote: Boolean(is_reconciliation_note)
	};
}

// NOTE: default warehouse is not used at the moment (it will be used for outbound notes)
export async function updateNote(db: DB, id: number, payload: { displayName?: string; defaultWarehouse?: number }): Promise<void> {
	const note = await getNoteById(db, id);
	if (note?.committed) {
		console.warn("Trying to update a committed note: this is a noop, but probably indicates a bug in the calling code.");
		return;
	}

	const { displayName, defaultWarehouse } = payload;

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

	const timestamp = Date.now();
	updateFields.push("updated_at = ?");
	updateValues.push(timestamp);

	const updateQuery = `
		UPDATE note
		SET ${updateFields.join(", ")}
		WHERE id = ?
	`;

	updateValues.push(id);

	await db.exec(updateQuery, updateValues);
}

async function getOutOfStockEntries(db: DB, noteId: number): Promise<OutOfStockTransaction[]> {
	const entries = (await getNoteEntries(db, noteId)) as Required<NoteEntriesItem>[];
	const stock = await getStock(db, { entries }).then((x) => new Map(x.map((e) => [[e.isbn, e.warehouseId].join("-"), e])));

	const res: OutOfStockTransaction[] = [];

	for (const { isbn, warehouseId, warehouseName, quantity } of entries) {
		const existingStock = stock.get([isbn, warehouseId].join("-"));
		if (!existingStock) {
			res.push({ isbn, warehouseId, quantity, available: 0, warehouseName });
			continue;
		}

		const { quantity: available } = existingStock;
		if (quantity > available) {
			res.push({ isbn, warehouseId, quantity, available, warehouseName });
		}
	}

	return res;
}

export async function getNoWarehouseEntries(db: DB, id: number): Promise<VolumeStock[]> {
	const query = `
		SELECT
			isbn,
			quantity,
			warehouse_id AS warehouseId
		FROM book_transaction
		WHERE note_id = ?
		AND warehouse_id = 0
	`;

	return db.execO<{
		isbn: string;
		quantity: number;
		warehouse_id: number;
	}>(query, [id]);
}

export async function commitNote(db: DB, id: number): Promise<void> {
	const note = await getNoteById(db, id);
	if (note?.committed) {
		console.warn("Trying to commit a note that is already committed: this is a noop, but probably indicates a bug in the calling code.");
		return;
	}

	const noWarehouseTxns = await getNoWarehouseEntries(db, id);
	if (noWarehouseTxns.length) {
		throw new NoWarehouseSelectedError(noWarehouseTxns);
	}

	if (note.noteType === "outbound") {
		const outOfStockEntries = await getOutOfStockEntries(db, id);
		if (outOfStockEntries.length) {
			throw new OutOfStockError(outOfStockEntries);
		}
	}

	const timestamp = Date.now();
	const query = `
		UPDATE note
		SET committed = 1, committed_at = ?
		WHERE id = ?
	`;

	await db.exec(query, [timestamp, id]);
}

export async function deleteNote(db: DB, id: number): Promise<void> {
	const note = await getNoteById(db, id);
	if (note?.committed) {
		console.warn("Trying to delete a committed note: this is a noop, but probably indicates a bug in the calling code.");
		return;
	}
	return db.exec("DELETE FROM note WHERE id = ?", [id]);
}

export async function addVolumesToNote(db: DB, noteId: number, volume: VolumeStock): Promise<void> {
	const note = await getNoteById(db, noteId);
	if (note?.committed) {
		console.warn("Cannot add volumes to a committed note.");
		return;
	}

	const { isbn, quantity } = volume;
	// If note.warehouseId is defined, we're within an inbound note - all txn warehouseIds should be the same as note.warehouseId
	// If not an inbound note (outbound/reconciliation), read the provided warehouseId, default to 0 (as 0 = 0, and NULL is never equal)
	const warehouseId = note.warehouseId || volume.warehouseId || 0;

	const insertOrUpdateTxnStmt = `
		INSERT INTO book_transaction (isbn, quantity, warehouse_id, note_id, updated_at)
		VALUES (?, ?, ?, ?, ?)
		ON CONFLICT(isbn, note_id, warehouse_id) DO UPDATE SET
			quantity = book_transaction.quantity + excluded.quantity,
			updated_at = excluded.updated_at
	`;

	await db.tx(async (txDb) => {
		const timestamp = Date.now();
		await txDb.exec(insertOrUpdateTxnStmt, [isbn, quantity, warehouseId, noteId, timestamp]);
		await txDb.exec(`UPDATE note SET updated_at = ? WHERE id = ?`, [timestamp, noteId]);
	});
}

export async function getNoteEntries(db: DB, id: number): Promise<NoteEntriesItem[]> {
	const query = `
		SELECT
			bt.isbn,
			bt.quantity,
			bt.warehouse_id AS warehouseId,
			COALESCE(w.display_name, 'not-found') AS warehouseName,
			COALESCE(w.discount, 0) AS warehouseDiscount,
			COALESCE(b.title, 'N/A') AS title,
			COALESCE(b.price, 0) AS price,
			COALESCE(b.year, 'N/A') AS year,
			COALESCE(b.authors, 'N/A') AS authors,
			COALESCE(b.publisher, '') AS publisher,
			COALESCE(b.edited_by, '') AS editedBy,
			b.out_of_print,
			COALESCE(b.category, '') AS category
		FROM book_transaction bt
		LEFT JOIN book b ON bt.isbn = b.isbn
		LEFT JOIN warehouse w ON bt.warehouse_id = w.id
		WHERE bt.note_id = ?
		ORDER BY bt.updated_at DESC
	`;

	const result = await db.execO<{
		isbn: string;
		quantity: number;
		warehouseId?: number;

		warehouseName?: string;
		warehouseDiscount: number;

		title: string;
		price: number;
		year: string;
		authors: string;
		publisher: string;
		editedBy: string;
		out_of_print: number;
		category: string;
	}>(query, [id]);

	return result.map(({ warehouseId, out_of_print, ...res }) => ({
		...res,
		warehouseId: warehouseId ?? undefined,
		outOfPrint: Boolean(out_of_print)
	}));
}

export async function updateNoteTxn(
	db: DB,
	noteId: number,
	curr: { isbn: string; warehouseId: number },
	next: { warehouseId: number; quantity: number }
): Promise<void> {
	const note = await getNoteById(db, noteId);
	if (note?.committed) {
		console.warn("Cannot update transactions of a committed note.");
		return;
	}

	const { isbn, warehouseId: currWarehouseId } = curr;
	const { warehouseId: nextWarehouseId, quantity: nextQuantity } = next;

	// Check if the transaction exists
	const [existingTxn] = await db.execO<{ updated_at: number }>(
		`SELECT updated_at FROM book_transaction WHERE note_id = ? AND isbn = ? AND warehouse_id = ?`,
		[noteId, isbn, currWarehouseId]
	);

	if (!existingTxn) {
		console.warn("Transaction not found.");
		return;
	}

	// We're deleting the existing txn and placing the new one instead of it
	// in case of mere update, we're keeping the original `updated_at`
	const { updated_at } = existingTxn;
	// In case of merging transactions, we're setting the `updated_at` to current timestamp: bubbling the
	// merged txn to the top of the list
	const timestamp = Date.now();

	await db.tx(async (txDb) => {
		await txDb.exec("DELETE FROM book_transaction WHERE isbn = ? AND warehouse_id = ? AND note_id = ?", [isbn, currWarehouseId, noteId]);
		await txDb.exec(
			`
			INSERT INTO book_transaction (isbn, note_id, warehouse_id, quantity, updated_at)
			VALUES (?, ?, ?, ?, ?)
			ON CONFLICT(isbn, note_id, warehouse_id) DO UPDATE SET
				quantity = book_transaction.quantity + excluded.quantity,
				updated_at = ?
		`,
			[isbn, noteId, nextWarehouseId, nextQuantity, updated_at, timestamp]
		);
		await txDb.exec(`UPDATE note SET updated_at = ? WHERE id = ?`, [timestamp, noteId]);
	});
}

export async function removeNoteTxn(db: DB, noteId: number, match: { isbn: string; warehouseId: number }): Promise<void> {
	const note = await getNoteById(db, noteId);
	if (note?.committed) {
		console.warn("Cannot delete transactions of a committed note.");
		return;
	}

	const { isbn, warehouseId } = match;

	await db.tx(async (txDb) => {
		await txDb.exec("DELETE FROM book_transaction WHERE isbn = ? AND warehouse_id = ? AND note_id = ?", [isbn, warehouseId, noteId]);
		await txDb.exec(`UPDATE note SET updated_at = ? WHERE id = ?`, [Date.now(), noteId]);
	});
}

export async function upsertNoteCustomItem(db: DB, noteId: number, payload: NoteCustomItem): Promise<void> {
	const note = await getNoteById(db, noteId);
	if (note?.committed) {
		console.warn("Cannot upsert custom items to a committed note.");
		return;
	}

	const { id, title, price } = payload;

	const timestamp = Date.now();

	// In case of conflict (update) we're keeping the initial 'updated_at' (to keep consistent display order)
	// NOTE: naming this `created_at` would have worked better in this case, but we're using `updated_at` to keep consistent with
	// book transactions ordering field
	const query = `
		INSERT INTO custom_item(id, note_id, title, price, updated_at)
		VALUES(?, ?, ?, ?, ?)
		ON CONFLICT(id, note_id) DO UPDATE SET
			title = excluded.title,
			price = excluded.price,
			updated_at = custom_item.updated_at
	`;

	await db.tx(async (txDb) => {
		await txDb.exec(query, [id, noteId, title, price, timestamp]);
		await txDb.exec(`UPDATE note SET updated_at = ? WHERE id = ?`, [timestamp, noteId]);
	});
}

export async function getNoteCustomItems(db: DB, noteId: number): Promise<NoteCustomItem[]> {
	const query = `
		SELECT id, title, price, updated_at
		FROM custom_item
		WHERE note_id = ?
		ORDER BY updated_at DESC
	`;

	const res = await db.execO<{ id: number; title: string; price: number; updated_at: number }>(query, [noteId]);

	return res.map(({ updated_at, ...item }) => ({ ...item, updatedAt: new Date(updated_at) }));
}

export async function removeNoteCustomItem(db: DB, noteId: number, itemId: number): Promise<void> {
	const note = await getNoteById(db, noteId);
	if (note?.committed) {
		console.warn("Cannot remove custom items from a committed note.");
		return;
	}

	await db.tx(async (txDb) => {
		await txDb.exec("DELETE FROM custom_item WHERE id = ? AND note_id = ?", [itemId, noteId]);
		await txDb.exec(`UPDATE note SET updated_at = ? WHERE id = ?`, [Date.now(), noteId]);
	});
}

export async function getReceiptForNote(db: DB, noteId: number): Promise<ReceiptData> {
	const note = await getNoteById(db, noteId);
	if (!note) {
		throw new Error("Note not found");
	}

	const bookQuery = `
		SELECT
			bt.isbn,
			bt.quantity,
			COALESCE(b.title, '') AS title,
			b.price,
			w.discount
		FROM book_transaction bt
		LEFT JOIN book b ON bt.isbn = b.isbn
		LEFT JOIN warehouse w ON bt.warehouse_id = w.id
		WHERE bt.note_id = ?
	`;

	const customItemQuery = `
		SELECT title, price
		FROM custom_item
		WHERE note_id = ?
	`;

	const bookEntries: ReceiptItem[] = await db.execO<ReceiptItem>(bookQuery, [noteId]).then((x) =>
		x.map((entry) => ({
			isbn: entry.isbn,
			title: entry.title,
			quantity: entry.quantity,
			price: entry.price || 0,
			discount: entry.discount || 0
		}))
	);

	const customItems: ReceiptItem[] = await db.execO<{ title: string; price: number }>(customItemQuery, [noteId]).then((x) =>
		x.map((item) => ({
			title: item.title,
			quantity: 1,
			price: item.price,
			discount: 0
		}))
	);

	return {
		items: bookEntries.concat(customItems),
		timestamp: Date.now()
	};
}

export async function createAndCommitReconciliationNote(db: DB, id: number, volumes: VolumeStock[]): Promise<void> {
	const timestamp = Date.now();
	const displayName = `Reconciliation note: ${new Date(timestamp).toISOString()}`;

	await db.tx(async (txDb) => {
		// Insert book transactions
		for (const volume of volumes) {
			// TODO: This isn't terribly efficient and should probably be run as a prepared statement, but having done so (with the exact same statement and args)
			// made the tests fail. Should investigate further
			await txDb.exec(
				"INSERT INTO book_transaction (isbn, quantity, warehouse_id, note_id, updated_at, committed_at) VALUES (?, ?, ?, ?, ?, ?)",
				[volume.isbn, volume.quantity, volume.warehouseId, id, timestamp, timestamp]
			);
		}

		// Insert the reconciliation note
		await txDb.exec(
			`INSERT INTO note (id, display_name, is_reconciliation_note, updated_at, committed, committed_at)
			VALUES (?, ?, 1, ?, 1, ?)`,
			[id, displayName, timestamp, timestamp]
		);
	});
}
