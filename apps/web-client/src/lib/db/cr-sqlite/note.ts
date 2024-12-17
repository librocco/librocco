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
	`;

	const res = await db.execO<{ id: number; displayName: string; warehouseName: string; updated_at: number }>(query);

	// TODO: update total books when we add note volume stock functionality
	return res.map(({ updated_at, ...el }) => ({ ...el, updatedAt: new Date(updated_at), totalBooks: 0 }));
}

export function deleteNote(db: DB, id: number) {
	return db.exec("DELETE FROM note WHERE id = ?", [id]);
}
