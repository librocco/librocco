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

export async function getAllWarehouses(db: DB): Promise<Warehouse[]> {
	const query = "SELECT id, display_name AS displayName, discount FROM warehouse";
	return db.execO<Warehouse>(query);
}
