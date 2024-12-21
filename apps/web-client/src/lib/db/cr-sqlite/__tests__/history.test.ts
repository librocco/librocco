import { describe, it, expect } from "vitest";
import { getRandomDb } from "./lib";
import { getPastNotes } from "../history";
import { createInboundNote, createOutboundNote, commitNote, addVolumesToNote } from "../note";
import { upsertWarehouse } from "../warehouse";
import { upsertBook } from "../books";

describe("getPastNotes", () => {
	it("retrieves past notes for a specific date", async () => {
		const db = await getRandomDb();

		// Set up warehouses
		await upsertWarehouse(db, { id: 1, displayName: "Warehouse 1", discount: 0 });
		await upsertWarehouse(db, { id: 2, displayName: "Warehouse 2", discount: 20 });

		// Set up books
		await upsertBook(db, { isbn: "1111111111", price: 10 });
		await upsertBook(db, { isbn: "2222222222", price: 20 });

		// Create and commit notes
		await createInboundNote(db, 1, 1);
		await addVolumesToNote(db, 1, { isbn: "1111111111", quantity: 5, warehouseId: 1 });
		await commitNote(db, 1);

		await createOutboundNote(db, 2);
		await addVolumesToNote(db, 2, { isbn: "1111111111", quantity: 3, warehouseId: 1 });
		await commitNote(db, 2);

		await createInboundNote(db, 2, 3);
		await addVolumesToNote(db, 3, { isbn: "1111111111", quantity: 5, warehouseId: 2 });
		await addVolumesToNote(db, 3, { isbn: "2222222222", quantity: 5, warehouseId: 2 });
		await commitNote(db, 3);

		await createOutboundNote(db, 4);
		await addVolumesToNote(db, 4, { isbn: "1111111111", quantity: 2, warehouseId: 1 });
		await addVolumesToNote(db, 4, { isbn: "2222222222", quantity: 3, warehouseId: 2 });
		await addVolumesToNote(db, 4, { isbn: "2222222222", quantity: 1, warehouseId: 2 });
		await commitNote(db, 4);

		// Directly update committed_at for testing
		//
		// Our control set of notes (shouldn't be returned)
		await db.exec("UPDATE note SET committed_at = strftime('%s', '2024-01-01') * 1000 WHERE id IN (1, 2)");

		// Our test set of notes (should be returned)
		//
		// NOTE: the test notes are timestamped in a reverse order of their ids - to test the results being ordered by date and note id
		await db.exec("UPDATE note SET committed_at = strftime('%s', '2024-01-02T10:00:00') * 1000 WHERE id IN (3)");
		await db.exec("UPDATE note SET committed_at = strftime('%s', '2024-01-02T09:00:00') * 1000 WHERE id IN (4)");

		const notes = await getPastNotes(db, "2024-01-02");

		expect(notes).toEqual([
			expect.objectContaining({
				id: 4,
				noteType: "outbound",
				totalBooks: 6,
				warehouseName: "Outbound",
				totalCoverPrice: 100,
				totalDiscountedPrice: 84
			}),
			expect.objectContaining({
				id: 3,
				noteType: "inbound",
				totalBooks: 10,
				warehouseName: "Warehouse 2",
				totalCoverPrice: 150,
				totalDiscountedPrice: 120
			})
		]);
	});
});
