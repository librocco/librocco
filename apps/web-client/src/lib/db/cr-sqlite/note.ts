import type { DB, TXAsync, InboundNoteListItem, VolumeStock, NoteEntriesItem } from "./types";

const getSeqName = async (db: DB | TXAsync) => {
	const sequenceQuery = `
			SELECT display_name AS displayName FROM note
			WHERE displayName LIKE 'New Note%'
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
		const displayName = await getSeqName(txDb);
		await txDb.exec(stmt, [noteId, displayName, warehouseId]);
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
};

export async function getNoteById(db: DB, id: number): Promise<GetNoteResponse | undefined> {
	const query = `
		SELECT
			note.id,
			note.display_name AS displayName,
			note.warehouse_id AS warehouseId,
			warehouse.display_name AS warehouseName,
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
		committedAt: committed_at ? new Date(committed_at) : undefined
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

export async function commitNote(db: DB, id: number): Promise<void> {
	const note = await getNoteById(db, id);
	if (note?.committed) {
		console.warn("Trying to commit a note that is already committed: this is a noop, but probably indicates a bug in the calling code.");
		return;
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

	return result;
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
