import type {
	DB,
	TXAsync,
	InboundNoteListItem,
	VolumeStock,
	NoteEntriesItem,
	OutboundNoteListItem,
	OutOfStockTransaction,
	ReceiptData,
	ReceiptItem
} from "./types";

import { NoWarehouseSelectedError, OutOfStockError } from "./errors";

const getSeqName = async (db: DB | TXAsync, kind: "inbound" | "outbound") => {
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
	const stmt = "INSERT INTO note (id, display_name, warehouse_id) VALUES (?, ?, ?)";

	return db.tx(async (txDb) => {
		const displayName = await getSeqName(txDb, "inbound");
		await txDb.exec(stmt, [noteId, displayName, warehouseId]);
	});
}

export function createOutboundNote(db: DB, noteId: number): Promise<void> {
	const stmt = "INSERT INTO note (id, display_name) VALUES (?, ?)";

	return db.tx(async (txDb) => {
		const displayName = await getSeqName(txDb, "outbound");
		await txDb.exec(stmt, [noteId, displayName]);
	});
}

export async function getAllInboundNotes(db: DB): Promise<InboundNoteListItem[]> {
	const query = `
		SELECT
			note.id,
			note.display_name AS displayName,
			warehouse.display_name AS warehouseName,
			note.updated_at
		FROM note
		INNER JOIN warehouse
		WHERE note.warehouse_id = warehouse.id
		AND note.committed = 0
	`;

	const res = await db.execO<{ id: number; displayName: string; warehouseName: string; updated_at: number }>(query);

	// TODO: update total books when we add note volume stock functionality
	return res.map(({ updated_at, ...el }) => ({ ...el, updatedAt: new Date(updated_at), totalBooks: 0 }));
}

export async function getAllOutboundNotes(db: DB): Promise<OutboundNoteListItem[]> {
	const query = `
		SELECT
			id,
			display_name AS displayName,
			updated_at
		FROM note
		WHERE warehouse_id IS NULL
		AND committed = 0

	`;

	const res = await db.execO<{ id: number; displayName: string; updated_at: number }>(query);

	// TODO: update total books when we add note volume stock functionality
	return res.map(({ updated_at, ...el }) => ({ ...el, updatedAt: new Date(updated_at), totalBooks: 0 }));
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

	updateFields.push("updated_at = (strftime('%s', 'now') * 1000)");

	const updateQuery = `
		UPDATE note
		SET ${updateFields.join(", ")}
		WHERE id = ?
	`;

	updateValues.push(id);

	await db.exec(updateQuery, updateValues);
}

// TODO: this should be implemented when we implement stock functionality
async function getOutOfStockEntries(_db: DB, _noteId: number): Promise<OutOfStockTransaction[]>;
async function getOutOfStockEntries(): Promise<OutOfStockTransaction[]> {
	return [];
}

export async function getNoWarehouseEntries(db: DB, id: number): Promise<VolumeStock[]> {
	const query = `
		SELECT
			isbn,
			quantity,
			warehouse_id AS warehouseId
		FROM book_transaction
		WHERE note_id = ?
		AND warehouse_id IS NULL
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

	const outOfStockEntries = await getOutOfStockEntries(db, id);
	if (outOfStockEntries.length) {
		throw new OutOfStockError(outOfStockEntries);
	}

	const query = `
		UPDATE note
		SET committed = 1, committed_at = (strftime('%s', 'now') * 1000)
		WHERE id = ?
	`;

	await db.exec(query, [id]);
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

	const { isbn, warehouseId, quantity } = volume;

	const insertOrUpdateTxnQuery = `
		INSERT INTO book_transaction (isbn, quantity, warehouse_id, note_id)
		VALUES (?, ?, ?, ?)
		ON CONFLICT(isbn, note_id, warehouse_id) DO UPDATE SET
			quantity = book_transaction.quantity + excluded.quantity,
			updated_at = (strftime('%s', 'now') * 1000)
	`;

	await db.exec(insertOrUpdateTxnQuery, [isbn, quantity, warehouseId, noteId]);
}

export async function getNoteEntries(db: DB, id: number): Promise<NoteEntriesItem[]> {
	const query = `
		SELECT
			bt.isbn,
			bt.quantity,
			bt.warehouse_id AS warehouseId,
			b.title,
			b.price,
			b.authors,
			b.publisher
		FROM book_transaction bt
		LEFT JOIN book b ON bt.isbn = b.isbn
		WHERE bt.note_id = ?
		ORDER BY bt.updated_at DESC
	`;

	const result = await db.execO<{
		isbn: string | null;
		quantity: number;
		warehouseId: number;
		title?: string;
		price?: number;
		authors?: string;
		publisher?: string;
	}>(query, [id]);

	return result.map(({ warehouseId, ...res }) => ({ ...res, warehouseId: warehouseId ?? undefined }));
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

	const { updated_at } = existingTxn;

	await db.exec("DELETE FROM book_transaction WHERE isbn = ? AND warehouse_id = ? AND note_id = ?", [isbn, currWarehouseId, noteId]);
	await db.exec(
		`
		INSERT INTO book_transaction (isbn, note_id, warehouse_id, quantity, updated_at)
		VALUES (?, ?, ?, ?, ?)
		ON CONFLICT(isbn, note_id, warehouse_id) DO UPDATE SET
			quantity = book_transaction.quantity + excluded.quantity,
			updated_at = (strftime('%s', 'now') * 1000)
		`,
		[isbn, noteId, nextWarehouseId, nextQuantity, updated_at]
	);
}

export async function removeNoteTxn(db: DB, noteId: number, match: { isbn: string; warehouseId: number }): Promise<void> {
	const note = await getNoteById(db, noteId);
	if (note?.committed) {
		console.warn("Cannot delete transactions of a committed note.");
		return;
	}

	const { isbn, warehouseId } = match;

	await db.exec("DELETE FROM book_transaction WHERE isbn = ? AND warehouse_id = ? AND note_id = ?", [isbn, warehouseId, noteId]);
}

export async function upsertNoteCustomItem(db: DB, noteId: number, payload: { id: number; title: string; price: number }): Promise<void> {
	const note = await getNoteById(db, noteId);
	if (note?.committed) {
		console.warn("Cannot upsert custom items to a committed note.");
		return;
	}

	const { id, title, price } = payload;

	const query = `
		INSERT INTO custom_item(id, note_id, title, price)
		VALUES(?, ?, ?, ?)
		ON CONFLICT(id, note_id) DO UPDATE SET
			title = excluded.title,
			price = excluded.price
	`;

	await db.exec(query, [id, noteId, title, price]);
}

export async function getNoteCustomItems(db: DB, noteId: number): Promise<{ id: number; title: string; price: number }[]> {
	const query = `
		SELECT id, title, price
		FROM custom_item
		WHERE note_id = ?
	`;

	return db.execO(query, [noteId]);
}

export async function removeNoteCustomItem(db: DB, noteId: number, itemId: number): Promise<void> {
	const note = await getNoteById(db, noteId);
	if (note?.committed) {
		console.warn("Cannot remove custom items from a committed note.");
		return;
	}

	await db.exec("DELETE FROM custom_item WHERE id = ? AND note_id = ?", [itemId, noteId]);
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
			b.title,
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
		timestamp: new Date().toISOString()
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
