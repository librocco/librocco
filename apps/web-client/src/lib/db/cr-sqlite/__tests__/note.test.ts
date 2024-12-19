import { describe, it, expect } from "vitest";

import { getRandomDb } from "./lib";

import { createInboundNote, deleteNote, getAllInboundNotes } from "../note";
import { upsertWarehouse } from "../warehouse";

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

	it("retrieves all inbound notes", async () => {
		const db = await getRandomDb();

		await upsertWarehouse(db, { id: 1, displayName: "Warehouse 1" });
		await upsertWarehouse(db, { id: 2, displayName: "Warehouse 2" });

		await createInboundNote(db, 1, 1);
		await createInboundNote(db, 1, 2);
		await createInboundNote(db, 2, 3);

		// TODO: update this when we implement the 'totalBooks' functionality
		expect(await getAllInboundNotes(db)).toEqual([
			{ id: 1, displayName: "New Note", warehouseName: "Warehouse 1", updatedAt: expect.any(Date), totalBooks: 0 },
			{ id: 2, displayName: "New Note (2)", warehouseName: "Warehouse 1", updatedAt: expect.any(Date), totalBooks: 0 },
			{ id: 3, displayName: "New Note (3)", warehouseName: "Warehouse 2", updatedAt: expect.any(Date), totalBooks: 0 }
		]);

		// TODO: add additional outbound notes to verify the list only retrieves the inbound notes (when we add outbound note functionality)
		// TODO: commit some notes to verify that the committed notes aren't displayed (when we add the commit functionality)
	});

	it("deletes a note", async () => {
		const db = await getRandomDb();

		await upsertWarehouse(db, { id: 1, displayName: "Warehouse 1" });

		await createInboundNote(db, 1, 1);
		await createInboundNote(db, 1, 2);

		// TODO: update this when we implement the 'totalBooks' functionality
		expect(await getAllInboundNotes(db)).toEqual([
			{ id: 1, displayName: "New Note", warehouseName: "Warehouse 1", updatedAt: expect.any(Date), totalBooks: 0 },
			{ id: 2, displayName: "New Note (2)", warehouseName: "Warehouse 1", updatedAt: expect.any(Date), totalBooks: 0 }
		]);

		await deleteNote(db, 1);
		expect(await getAllInboundNotes(db)).toEqual([
			{ id: 2, displayName: "New Note (2)", warehouseName: "Warehouse 1", updatedAt: expect.any(Date), totalBooks: 0 }
		]);
	});
});
