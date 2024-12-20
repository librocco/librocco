import { describe, it, expect } from "vitest";

import { getRandomDb } from "./lib";

import { createInboundNote } from "../note";

describe("Inbound note tests", () => {
	it("creates a new inbound note, using id and warehouseId, with default fields", async () => {
		const db = await getRandomDb();

		await createInboundNote(db, 1, 1);

		const res = await db.execO("SELECT * FROM note");

		expect(res).toEqual([
			{ id: 1, display_name: "New Note", warehouse_id: 1, is_reconciliation_note: 0, updated_at: expect.any(Number), committed: 0 }
		]);
	});

	it("assigns default note name continuing the sequence", async () => {
		const db = await getRandomDb();

		const query = "SELECT id, display_name AS displayName FROM note";

		await createInboundNote(db, 1, 1);
		expect(await db.execO(query)).toEqual([{ id: 1, displayName: "New Note" }]);

		await createInboundNote(db, 1, 2);
		expect(await db.execO(query)).toEqual([
			{ id: 1, displayName: "New Note" },
			{ id: 2, displayName: "New Note (2)" }
		]);

		// TODO: this will need to be expanded later
	});
});
