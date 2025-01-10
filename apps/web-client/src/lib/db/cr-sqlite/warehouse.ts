import type { PickPartial } from "@librocco/db";

import type { DB, TXAsync, Warehouse } from "./types";

const getSeqName = async (db: DB | TXAsync) => {
	const sequenceQuery = `
			SELECT display_name AS displayName FROM warehouse
			WHERE displayName LIKE 'New Warehouse%'
			ORDER BY displayName DESC
			LIMIT 1;
		`;
	const result = await db.execO<{ displayName?: string }>(sequenceQuery);
	const displayName = result[0]?.displayName;

	if (!displayName) {
		return "New Warehouse";
	}

	if (displayName === "New Warehouse") {
		return "New Warehouse (2)";
	}

	const maxSequence = Number(displayName.replace("New Warehouse", "").replace("(", "").replace(")", "").trim()) + 1;

	return `New Warehouse (${maxSequence})`;
};

export function upsertWarehouse(db: DB, data: PickPartial<Warehouse, "displayName" | "discount">): Promise<void> {
	if (!data.id) {
		throw new Error("Warehouse must have an id");
	}

	const _data = { ...data };

	return db.tx(async (txDb) => {
		_data.displayName = data.displayName || (await getSeqName(txDb));

		const keys = Object.keys(_data).map((x) => (x === "displayName" ? "display_name" : x));
		const values = Object.values(_data);

		const query = `
        INSERT INTO warehouse (${keys.join(",")})
        VALUES (${keys.map(() => "?").join(",")})
        ON CONFLICT(id) DO UPDATE SET
            display_name = COALESCE(?, display_name),
            discount = COALESCE(?, discount);
    `;
		await txDb.exec(query, [...values, data.displayName, _data.discount ?? null]);
	});
}

export async function getAllWarehouses(db: DB): Promise<(Warehouse & { totalBooks: number })[]> {
	// NOTE: there's a n.committed IS NULL constraint
	// - this makes sure there are no issues if warehouse doesn't have any notes associated with it
	// - we make sure committed = 0 (default) and is never null to avoid miscalculations here
	//   ^ the tests thouroughly test this
	const query = `
		SELECT
			w.id,
			w.display_name AS displayName,
			w.discount,
			COALESCE(SUM(CASE WHEN n.warehouse_id IS NOT NULL OR n.is_reconciliation_note = 1 THEN bt.quantity ELSE -bt.quantity END), 0) AS totalBooks
		FROM warehouse w
		LEFT JOIN book_transaction bt ON w.id = bt.warehouse_id
		LEFT JOIN note n ON bt.note_id = n.id
		WHERE n.committed = 1 OR n.committed IS NULL
		GROUP BY w.id
	`;
	return db.execO<Warehouse & { totalBooks: number }>(query);
}
