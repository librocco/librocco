import type { DB, TXAsync } from "./types";

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
