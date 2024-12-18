import type { DB, TXAsync, InboundNoteListItem } from "./types";

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
