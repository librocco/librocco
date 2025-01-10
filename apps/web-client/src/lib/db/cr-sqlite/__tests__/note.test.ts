import { describe, it, expect } from "vitest";

import type { DB } from "../types";

import { getRandomDb } from "./lib";
import { NoWarehouseSelectedError, OutOfStockError } from "../errors";

import {
	createInboundNote,
	createOutboundNote,
	updateNote,
	deleteNote,
	getAllInboundNotes,
	getAllOutboundNotes,
	getNoteById,
	commitNote,
	addVolumesToNote,
	getNoteEntries,
	updateNoteTxn,
	removeNoteTxn,
	upsertNoteCustomItem,
	getNoteCustomItems,
	removeNoteCustomItem,
	getReceiptForNote
} from "../note";
import { upsertWarehouse } from "../warehouse";
import { upsertBook } from "../books";

describe("Inbound note tests", () => {
	it("creates a new inbound note, using id and warehouseId, with default fields", async () => {
		const db = await getRandomDb();

		await createInboundNote(db, 1, 1);

		const res = await db.execO("SELECT * FROM note");

		expect(res).toEqual([
			expect.objectContaining({
				id: 1,
				display_name: "New Note",
				warehouse_id: 1,
				is_reconciliation_note: 0,
				updated_at: expect.any(Number),
				committed: 0,
				committed_at: null
			})
		]);
	});

	it("retrieves an inbound note using getNoteById", async () => {
		const db = await getRandomDb();

		await upsertWarehouse(db, { id: 1, displayName: "Warehouse 1" });

		await createInboundNote(db, 1, 1);

		const note = await getNoteById(db, 1);

		expect(note).toEqual(
			expect.objectContaining({
				id: 1,
				displayName: "New Note",
				warehouseId: 1,
				warehouseName: "Warehouse 1",
				noteType: "inbound",
				updatedAt: expect.any(Date),
				committed: false,
				committedAt: undefined
			})
		);
	});

	it("retrieves all inbound notes", async () => {
		const db = await getRandomDb();

		await upsertWarehouse(db, { id: 1, displayName: "Warehouse 1" });
		await upsertWarehouse(db, { id: 2, displayName: "Warehouse 2" });

		await createInboundNote(db, 1, 1);
		await createInboundNote(db, 1, 2);
		await createInboundNote(db, 2, 3);

		expect(await getAllInboundNotes(db)).toEqual([
			{ id: 1, displayName: "New Note", warehouseName: "Warehouse 1", updatedAt: expect.any(Date), totalBooks: 0 },
			{ id: 2, displayName: "New Note (2)", warehouseName: "Warehouse 1", updatedAt: expect.any(Date), totalBooks: 0 },
			{ id: 3, displayName: "New Note (3)", warehouseName: "Warehouse 2", updatedAt: expect.any(Date), totalBooks: 0 }
		]);

		// Committed notes aren't displayed in the list
		await commitNote(db, 1);
		expect(await getAllInboundNotes(db)).toEqual([
			{ id: 2, displayName: "New Note (2)", warehouseName: "Warehouse 1", updatedAt: expect.any(Date), totalBooks: 0 },
			{ id: 3, displayName: "New Note (3)", warehouseName: "Warehouse 2", updatedAt: expect.any(Date), totalBooks: 0 }
		]);

		// Add an outbond note (as noise) - this shouldn't be returned
		await createOutboundNote(db, 4);
		expect(await getAllInboundNotes(db)).toEqual([
			{ id: 2, displayName: "New Note (2)", warehouseName: "Warehouse 1", updatedAt: expect.any(Date), totalBooks: 0 },
			{ id: 3, displayName: "New Note (3)", warehouseName: "Warehouse 2", updatedAt: expect.any(Date), totalBooks: 0 }
		]);
	});

	it("commits an inbound note", async () => {
		const db = await getRandomDb();

		await upsertWarehouse(db, { id: 1, displayName: "Warehouse 1" });
		await createInboundNote(db, 1, 1);

		let note = await getNoteById(db, 1);
		expect(note).toEqual(
			expect.objectContaining({
				committed: false,
				committedAt: undefined
			})
		);

		await commitNote(db, 1);

		note = await getNoteById(db, 1);
		expect(note).toEqual(
			expect.objectContaining({
				committed: true,
				committedAt: expect.any(Date)
			})
		);
	});

	it("doesn't allow committing of a note more than once (keeping the committed_at consistent)", async () => {
		const db = await getRandomDb();

		await upsertWarehouse(db, { id: 1, displayName: "Warehouse 1" });
		await createInboundNote(db, 1, 1);

		// Commit the note for the first time
		await commitNote(db, 1);
		let note = await getNoteById(db, 1);
		expect(note).toEqual(
			expect.objectContaining({
				committed: true,
				committedAt: expect.any(Date)
			})
		);

		const firstCommitTime = note.committedAt;

		// Attempt to commit the note again

		// The DB saves updated_at with second intervals
		// Wait for a second to observe the updated_at updated between writes
		await new Promise((res) => setTimeout(res, 1000));
		await commitNote(db, 1);
		note = await getNoteById(db, 1);
		expect(note).toEqual(
			expect.objectContaining({
				committed: true,
				committedAt: firstCommitTime // Should remain unchanged
			})
		);
	});

	it("updates a note (displayName) as instructed and updates the 'updated_at' field (under the hood)", async () => {
		const db = await getRandomDb();

		await createInboundNote(db, 1, 1);

		let note = await getNoteById(db, 1);
		expect(note).toEqual(
			expect.objectContaining({
				id: 1,
				displayName: "New Note",
				updatedAt: expect.any(Date),
				committed: false,
				committedAt: undefined
			})
		);
		const { updatedAt } = note;

		// The DB saves updated_at with second intervals
		// Wait for a second to observe the updated_at updated between writes
		await new Promise((res) => setTimeout(res, 1000));
		await updateNote(db, 1, { displayName: "Updated Note" });

		note = await getNoteById(db, 1);
		expect(note).toEqual(
			expect.objectContaining({
				id: 1,
				displayName: "Updated Note",
				noteType: "inbound",
				updatedAt: expect.any(Date),
				committed: false,
				committedAt: undefined
			})
		);

		// The updated at should be newer
		expect(note.updatedAt > updatedAt).toEqual(true);
	});

	it("doesn't allow updates after the note had been committed", async () => {
		const db = await getRandomDb();

		await upsertWarehouse(db, { id: 1, displayName: "Warehouse 1" });
		await createInboundNote(db, 1, 1);
		await updateNote(db, 1, { displayName: "Note 1" });
		let note = await getNoteById(db, 1);
		expect(note).toEqual(
			expect.objectContaining({
				displayName: "Note 1", // Should remain unchanged
				committed: false,
				updatedAt: expect.any(Date)
			})
		);
		const updatedAt = note.updatedAt;

		// Commit the note
		await commitNote(db, 1);

		// Attempt to update the note
		await updateNote(db, 1, { displayName: "Updated Note" });

		// Retrieve the note to verify it hasn't been updated
		note = await getNoteById(db, 1);
		expect(note).toEqual(
			expect.objectContaining({
				displayName: "Note 1", // Should remain unchanged
				committed: true
			})
		);
		expect(note.updatedAt).toEqual(updatedAt);
	});

	it("assigns default note name continuing the sequence", async () => {
		const db = await getRandomDb();

		// Create note 1, default name should be 'New Note'
		await upsertWarehouse(db, { id: 1, displayName: "Warehouse 1" });
		await createInboundNote(db, 1, 1);
		let res = await getAllInboundNotes(db);
		expect(res).toEqual([{ id: 1, displayName: "New Note", warehouseName: "Warehouse 1", updatedAt: expect.any(Date), totalBooks: 0 }]);

		// Create note 2, default name should be 'New Note (2)'
		await createInboundNote(db, 1, 2);
		res = await getAllInboundNotes(db);
		expect(res).toEqual([
			{ id: 1, displayName: "New Note", warehouseName: "Warehouse 1", updatedAt: expect.any(Date), totalBooks: 0 },
			{ id: 2, displayName: "New Note (2)", warehouseName: "Warehouse 1", updatedAt: expect.any(Date), totalBooks: 0 }
		]);

		// Rename note 1 to 'Note 1'
		await updateNote(db, 1, { displayName: "Note 1" });
		res = await getAllInboundNotes(db);
		expect(res).toEqual([
			{ id: 1, displayName: "Note 1", warehouseName: "Warehouse 1", updatedAt: expect.any(Date), totalBooks: 0 },
			{ id: 2, displayName: "New Note (2)", warehouseName: "Warehouse 1", updatedAt: expect.any(Date), totalBooks: 0 }
		]);

		// Create note 3, default name should be 'New Note (3)' (continuing the sequence)
		await createInboundNote(db, 1, 3);
		res = await getAllInboundNotes(db);
		expect(res).toEqual([
			{ id: 1, displayName: "Note 1", warehouseName: "Warehouse 1", updatedAt: expect.any(Date), totalBooks: 0 },
			{ id: 2, displayName: "New Note (2)", warehouseName: "Warehouse 1", updatedAt: expect.any(Date), totalBooks: 0 },
			{ id: 3, displayName: "New Note (3)", warehouseName: "Warehouse 1", updatedAt: expect.any(Date), totalBooks: 0 }
		]);

		// Rename note 2 to 'Note 2'
		await updateNote(db, 2, { displayName: "Note 2" });
		// Rename note 3 to 'Note 3'
		await updateNote(db, 3, { displayName: "Note 3" });
		res = await getAllInboundNotes(db);
		expect(res).toEqual([
			{ id: 1, displayName: "Note 1", warehouseName: "Warehouse 1", updatedAt: expect.any(Date), totalBooks: 0 },
			{ id: 2, displayName: "Note 2", warehouseName: "Warehouse 1", updatedAt: expect.any(Date), totalBooks: 0 },
			{ id: 3, displayName: "Note 3", warehouseName: "Warehouse 1", updatedAt: expect.any(Date), totalBooks: 0 }
		]);

		// Create note 4, default name should be 'New Note' (restarting the sequence)
		await createInboundNote(db, 1, 4);
		res = await getAllInboundNotes(db);
		expect(res).toEqual([
			{ id: 1, displayName: "Note 1", warehouseName: "Warehouse 1", updatedAt: expect.any(Date), totalBooks: 0 },
			{ id: 2, displayName: "Note 2", warehouseName: "Warehouse 1", updatedAt: expect.any(Date), totalBooks: 0 },
			{ id: 3, displayName: "Note 3", warehouseName: "Warehouse 1", updatedAt: expect.any(Date), totalBooks: 0 },
			{ id: 4, displayName: "New Note", warehouseName: "Warehouse 1", updatedAt: expect.any(Date), totalBooks: 0 }
		]);

		// Adding an outbound note shouldn't mess with the sequence
		await createOutboundNote(db, 5); // Latest (inbound note sequence) should still be 1 - "New Note"
		await createInboundNote(db, 1, 6); // New Note (2) - continuing as if the outbound note doesn't exist
		res = await getAllInboundNotes(db);
		expect(res).toEqual([
			{ id: 1, displayName: "Note 1", warehouseName: "Warehouse 1", updatedAt: expect.any(Date), totalBooks: 0 },
			{ id: 2, displayName: "Note 2", warehouseName: "Warehouse 1", updatedAt: expect.any(Date), totalBooks: 0 },
			{ id: 3, displayName: "Note 3", warehouseName: "Warehouse 1", updatedAt: expect.any(Date), totalBooks: 0 },
			{ id: 4, displayName: "New Note", warehouseName: "Warehouse 1", updatedAt: expect.any(Date), totalBooks: 0 },
			{ id: 6, displayName: "New Note (2)", warehouseName: "Warehouse 1", updatedAt: expect.any(Date), totalBooks: 0 }
		]);

		// Adding a note to a different warehouse should still continue the sequence
		await upsertWarehouse(db, { id: 2, displayName: "Warehouse 2" });
		await createInboundNote(db, 2, 7); // New Note (2) - continuing as if the outbound note doesn't exist
		res = await getAllInboundNotes(db);
		expect(res).toEqual([
			{ id: 1, displayName: "Note 1", warehouseName: "Warehouse 1", updatedAt: expect.any(Date), totalBooks: 0 },
			{ id: 2, displayName: "Note 2", warehouseName: "Warehouse 1", updatedAt: expect.any(Date), totalBooks: 0 },
			{ id: 3, displayName: "Note 3", warehouseName: "Warehouse 1", updatedAt: expect.any(Date), totalBooks: 0 },
			{ id: 4, displayName: "New Note", warehouseName: "Warehouse 1", updatedAt: expect.any(Date), totalBooks: 0 },
			{ id: 6, displayName: "New Note (2)", warehouseName: "Warehouse 1", updatedAt: expect.any(Date), totalBooks: 0 },
			{ id: 7, displayName: "New Note (3)", warehouseName: "Warehouse 2", updatedAt: expect.any(Date), totalBooks: 0 }
		]);
	});

	it("deletes an inbound note", async () => {
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

	it("doesn't allow deletion of a committed note", async () => {
		const db = await getRandomDb();

		await upsertWarehouse(db, { id: 1, displayName: "Warehouse 1" });
		await createInboundNote(db, 1, 1);

		// Commit the note
		await commitNote(db, 1);

		// Attempt to delete the committed note
		await deleteNote(db, 1);

		// Verify the note still exists
		const note = await getNoteById(db, 1);
		expect(note).toBeDefined();
		expect(note).toEqual(
			expect.objectContaining({
				id: 1,
				displayName: "New Note",
				committed: true
			})
		);
	});
});

describe("Outbound note tests", () => {
	it("creates a new outbound note, using id, with default fields", async () => {
		const db = await getRandomDb();

		await createOutboundNote(db, 1);

		const res = await db.execO("SELECT * FROM note");

		expect(res).toEqual([
			expect.objectContaining({
				id: 1,
				display_name: "New Note",
				is_reconciliation_note: 0,
				warehouse_id: null,
				updated_at: expect.any(Number),
				committed: 0,
				committed_at: null
			})
		]);
	});

	it("retrieves an outbound note using getNoteById", async () => {
		const db = await getRandomDb();

		await createOutboundNote(db, 1);
		const note = await getNoteById(db, 1);

		expect(note).toEqual(
			expect.objectContaining({
				id: 1,
				displayName: "New Note",
				warehouseId: null,
				warehouseName: null,
				defaultWarehouse: null,
				noteType: "outbound",
				updatedAt: expect.any(Date),
				committed: false,
				committedAt: undefined
			})
		);
	});

	it("retrieves all outbound notes", async () => {
		const db = await getRandomDb();

		await createOutboundNote(db, 1);
		await createOutboundNote(db, 2);
		await createOutboundNote(db, 3);

		expect(await getAllOutboundNotes(db)).toEqual([
			{ id: 1, displayName: "New Note", updatedAt: expect.any(Date), totalBooks: 0 },
			{ id: 2, displayName: "New Note (2)", updatedAt: expect.any(Date), totalBooks: 0 },
			{ id: 3, displayName: "New Note (3)", updatedAt: expect.any(Date), totalBooks: 0 }
		]);

		// Committed notes aren't displayed in the list
		await commitNote(db, 1);
		expect(await getAllOutboundNotes(db)).toEqual([
			{ id: 2, displayName: "New Note (2)", updatedAt: expect.any(Date), totalBooks: 0 },
			{ id: 3, displayName: "New Note (3)", updatedAt: expect.any(Date), totalBooks: 0 }
		]);

		// Add an outbond note (as noise) - this shouldn't be returned
		await upsertWarehouse(db, { id: 1, displayName: "Warehouse 1" });
		await createInboundNote(db, 1, 4);
		expect(await getAllOutboundNotes(db)).toEqual([
			{ id: 2, displayName: "New Note (2)", updatedAt: expect.any(Date), totalBooks: 0 },
			{ id: 3, displayName: "New Note (3)", updatedAt: expect.any(Date), totalBooks: 0 }
		]);
	});

	it("commits an outbound note", async () => {
		const db = await getRandomDb();

		await createOutboundNote(db, 1);

		let note = await getNoteById(db, 1);
		expect(note).toEqual(
			expect.objectContaining({
				committed: false,
				committedAt: undefined
			})
		);

		await commitNote(db, 1);

		note = await getNoteById(db, 1);
		expect(note).toEqual(
			expect.objectContaining({
				committed: true,
				committedAt: expect.any(Date)
			})
		);
	});

	it("doesn't allow for committing of a note if not all warehouse ids are assigned", async () => {
		const db = await getRandomDb();

		await createOutboundNote(db, 1);

		await addVolumesToNote(db, 1, { isbn: "1111111111", quantity: 2 });
		await addVolumesToNote(db, 1, { isbn: "2222222222", quantity: 2 });
		await addVolumesToNote(db, 1, { isbn: "3333333333", quantity: 2, warehouseId: 1 }); // Has a warehouse assigned to it - OK

		expect(commitNote(db, 1)).rejects.toThrow(
			new NoWarehouseSelectedError([
				{ isbn: "1111111111", quantity: 2 },
				{ isbn: "2222222222", quantity: 2 }
			])
		);
	});

	// TODO: this needs stock calculating logic in order to work, unskip when the logic is implemented
	it.skip("doesn't allow for committing of a note if some transactions would result in negative stock", async () => {
		const db = await getRandomDb();

		// Set up state
		await upsertWarehouse(db, { id: 1, displayName: "Warehouse 1" });
		await upsertWarehouse(db, { id: 2, displayName: "Warehouse 2" });

		await createInboundNote(db, 1, 1);
		await addVolumesToNote(db, 1, { isbn: "1111111111", quantity: 2 });
		await addVolumesToNote(db, 1, { isbn: "2222222222", quantity: 2 });
		await commitNote(db, 1);

		await createInboundNote(db, 2, 2);
		await addVolumesToNote(db, 2, { isbn: "2222222222", quantity: 2 });
		await commitNote(db, 2);

		await createOutboundNote(db, 3);

		await addVolumesToNote(db, 3, { isbn: "1111111111", quantity: 3, warehouseId: 1 }); // avlbl: 2, res = -1
		await addVolumesToNote(db, 3, { isbn: "2222222222", quantity: 2, warehouseId: 1 }); // avlbl: 2, res = 0 -- OK
		await addVolumesToNote(db, 3, { isbn: "1111111111", quantity: 3, warehouseId: 2 }); // avlbl: 0, res = -3
		await addVolumesToNote(db, 3, { isbn: "2222222222", quantity: 4, warehouseId: 2 }); // avlbl: 2, res = -2

		expect(await commitNote(db, 1)).toThrow(
			new OutOfStockError([
				{ isbn: "1111111111", quantity: 3, warehouseId: 1, available: 2, warehouseName: "Warehouse 1" },
				{ isbn: "1111111111", quantity: 3, warehouseId: 2, available: 0, warehouseName: "Warehouse 2" },
				{ isbn: "2222222222", quantity: 4, warehouseId: 2, available: 2, warehouseName: "Warehouse 2" }
			])
		);
	});

	it("doesn't allow committing of a note more than once (keeping the committed_at consistent)", async () => {
		const db = await getRandomDb();

		await createOutboundNote(db, 1);

		// Commit the note for the first time
		await commitNote(db, 1);
		let note = await getNoteById(db, 1);
		expect(note).toEqual(
			expect.objectContaining({
				committed: true,
				committedAt: expect.any(Date)
			})
		);

		const firstCommitTime = note.committedAt;

		// Attempt to commit the note again

		// The DB saves updated_at with second intervals
		// Wait for a second to observe the updated_at updated between writes
		await new Promise((res) => setTimeout(res, 1000));
		await commitNote(db, 1);
		note = await getNoteById(db, 1);
		expect(note).toEqual(
			expect.objectContaining({
				committed: true,
				committedAt: firstCommitTime // Should remain unchanged
			})
		);
	});

	it("updates an outbound note (displayName, defaultWarehouse) as instructed and updates the 'updated_at' field (under the hood)", async () => {
		const db = await getRandomDb();

		await createOutboundNote(db, 1);

		let note = await getNoteById(db, 1);
		expect(note).toEqual(
			expect.objectContaining({
				id: 1,
				displayName: "New Note",
				updatedAt: expect.any(Date),
				committed: false,
				committedAt: undefined
			})
		);
		const { updatedAt } = note;

		// The DB saves updated_at with second intervals
		// Wait for a second to observe the updated_at updated between writes
		await new Promise((res) => setTimeout(res, 1000));
		await updateNote(db, 1, { displayName: "Updated Note" });

		note = await getNoteById(db, 1);
		expect(note).toEqual(
			expect.objectContaining({
				id: 1,
				displayName: "Updated Note",
				noteType: "outbound",
				updatedAt: expect.any(Date),
				committed: false,
				committedAt: undefined
			})
		);

		// The updated at should be newer
		expect(note.updatedAt > updatedAt).toEqual(true);

		// The DB saves updated_at with second intervals
		// Wait for a second to observe the updated_at updated between writes
		await new Promise((res) => setTimeout(res, 1000));
		await updateNote(db, 1, { defaultWarehouse: 1 });

		note = await getNoteById(db, 1);
		expect(note).toEqual(
			expect.objectContaining({
				id: 1,
				displayName: "Updated Note",
				noteType: "outbound",
				defaultWarehouse: 1,
				updatedAt: expect.any(Date),
				committed: false,
				committedAt: undefined
			})
		);

		// The updated at should be newer
		expect(note.updatedAt > updatedAt).toEqual(true);
	});

	it("doesn't allow updates after the note had been committed", async () => {
		const db = await getRandomDb();

		await createOutboundNote(db, 1);
		await updateNote(db, 1, { displayName: "Note 1" });
		let note = await getNoteById(db, 1);
		expect(note).toEqual(
			expect.objectContaining({
				displayName: "Note 1", // Should remain unchanged
				committed: false,
				updatedAt: expect.any(Date)
			})
		);
		const updatedAt = note.updatedAt;

		// Commit the note
		await commitNote(db, 1);

		// Attempt to update the note
		await updateNote(db, 1, { displayName: "Updated Note" });
		await updateNote(db, 1, { defaultWarehouse: 2 });

		// Retrieve the note to verify it hasn't been updated
		note = await getNoteById(db, 1);
		expect(note).toEqual(
			expect.objectContaining({
				displayName: "Note 1", // Should remain unchanged
				committed: true
			})
		);
		expect(note.updatedAt).toEqual(updatedAt);
	});

	it("assigns default note name continuing the sequence", async () => {
		const db = await getRandomDb();

		// Create note 1, default name should be 'New Note'
		await createOutboundNote(db, 1);
		let res = await getAllOutboundNotes(db);
		expect(res).toEqual([{ id: 1, displayName: "New Note", updatedAt: expect.any(Date), totalBooks: 0 }]);

		// Create note 2, default name should be 'New Note (2)'
		await createOutboundNote(db, 2);
		res = await getAllOutboundNotes(db);
		expect(res).toEqual([
			{ id: 1, displayName: "New Note", updatedAt: expect.any(Date), totalBooks: 0 },
			{ id: 2, displayName: "New Note (2)", updatedAt: expect.any(Date), totalBooks: 0 }
		]);

		// Rename note 1 to 'Note 1'
		await updateNote(db, 1, { displayName: "Note 1" });
		res = await getAllOutboundNotes(db);
		expect(res).toEqual([
			{ id: 1, displayName: "Note 1", updatedAt: expect.any(Date), totalBooks: 0 },
			{ id: 2, displayName: "New Note (2)", updatedAt: expect.any(Date), totalBooks: 0 }
		]);

		// Create note 3, default name should be 'New Note (3)' (continuing the sequence)
		await createOutboundNote(db, 3);
		res = await getAllOutboundNotes(db);
		expect(res).toEqual([
			{ id: 1, displayName: "Note 1", updatedAt: expect.any(Date), totalBooks: 0 },
			{ id: 2, displayName: "New Note (2)", updatedAt: expect.any(Date), totalBooks: 0 },
			{ id: 3, displayName: "New Note (3)", updatedAt: expect.any(Date), totalBooks: 0 }
		]);

		// Rename note 2 to 'Note 2'
		await updateNote(db, 2, { displayName: "Note 2" });
		// Rename note 3 to 'Note 3'
		await updateNote(db, 3, { displayName: "Note 3" });
		res = await getAllOutboundNotes(db);
		expect(res).toEqual([
			{ id: 1, displayName: "Note 1", updatedAt: expect.any(Date), totalBooks: 0 },
			{ id: 2, displayName: "Note 2", updatedAt: expect.any(Date), totalBooks: 0 },
			{ id: 3, displayName: "Note 3", updatedAt: expect.any(Date), totalBooks: 0 }
		]);

		// Create note 4, default name should be 'New Note' (restarting the sequence)
		await createOutboundNote(db, 4);
		res = await getAllOutboundNotes(db);
		expect(res).toEqual([
			{ id: 1, displayName: "Note 1", updatedAt: expect.any(Date), totalBooks: 0 },
			{ id: 2, displayName: "Note 2", updatedAt: expect.any(Date), totalBooks: 0 },
			{ id: 3, displayName: "Note 3", updatedAt: expect.any(Date), totalBooks: 0 },
			{ id: 4, displayName: "New Note", updatedAt: expect.any(Date), totalBooks: 0 }
		]);

		// Adding an inbound note shouldn't mess with the sequence
		await createInboundNote(db, 1, 5); // Latest (outbound note sequence) should still be 1 - "New Note"
		await createOutboundNote(db, 6); // New Note (2) - continuing as if the inbound note doesn't exist
		res = await getAllOutboundNotes(db);
		expect(res).toEqual([
			{ id: 1, displayName: "Note 1", updatedAt: expect.any(Date), totalBooks: 0 },
			{ id: 2, displayName: "Note 2", updatedAt: expect.any(Date), totalBooks: 0 },
			{ id: 3, displayName: "Note 3", updatedAt: expect.any(Date), totalBooks: 0 },
			{ id: 4, displayName: "New Note", updatedAt: expect.any(Date), totalBooks: 0 },
			{ id: 6, displayName: "New Note (2)", updatedAt: expect.any(Date), totalBooks: 0 }
		]);
	});

	it("doesn't allow deletion of a committed note", async () => {
		const db = await getRandomDb();

		await createOutboundNote(db, 1);

		// Commit the note
		await commitNote(db, 1);

		// Attempt to delete the committed note
		await deleteNote(db, 1);

		// Verify the note still exists
		const note = await getNoteById(db, 1);
		expect(note).toBeDefined();
		expect(note).toEqual(
			expect.objectContaining({
				id: 1,
				displayName: "New Note",
				committed: true
			})
		);
	});

	it("deletes an outboudn note", async () => {
		const db = await getRandomDb();

		await createOutboundNote(db, 1);
		await createOutboundNote(db, 2);

		// TODO: update this when we implement the 'totalBooks' functionality
		expect(await getAllOutboundNotes(db)).toEqual([
			{ id: 1, displayName: "New Note", updatedAt: expect.any(Date), totalBooks: 0 },
			{ id: 2, displayName: "New Note (2)", updatedAt: expect.any(Date), totalBooks: 0 }
		]);

		await deleteNote(db, 1);
		expect(await getAllOutboundNotes(db)).toEqual([{ id: 2, displayName: "New Note (2)", updatedAt: expect.any(Date), totalBooks: 0 }]);
	});

	it("doesn't allow deletion of a committed note", async () => {
		const db = await getRandomDb();

		await upsertWarehouse(db, { id: 1, displayName: "Warehouse 1" });
		await createOutboundNote(db, 1);

		// Commit the note
		await commitNote(db, 1);

		// Attempt to delete the committed note
		await deleteNote(db, 1);

		// Verify the note still exists
		const note = await getNoteById(db, 1);
		expect(note).toBeDefined();
		expect(note).toEqual(
			expect.objectContaining({
				id: 1,
				displayName: "New Note",
				committed: true
			})
		);
	});

	it("retrieves the receipt using getReceiptForNote", async () => {
		const db = await getRandomDb();

		// Create warehouses
		await upsertWarehouse(db, { id: 1, displayName: "Warehouse 1", discount: 10 });
		await upsertWarehouse(db, { id: 2, displayName: "Warehouse 2", discount: 0 });

		// Add book data
		await upsertBook(db, { isbn: "1111111111", title: "Book 1" });
		await upsertBook(db, { isbn: "2222222222", title: "Book 2" });

		// Create an outbound note
		await createOutboundNote(db, 1);

		// Add book transactions
		await addVolumesToNote(db, 1, { isbn: "1111111111", quantity: 2, warehouseId: 1 });
		await addVolumesToNote(db, 1, { isbn: "2222222222", quantity: 3, warehouseId: 2 });

		// Add custom items
		await upsertNoteCustomItem(db, 1, { id: 1, title: "Custom Item 1", price: 50 });
		await upsertNoteCustomItem(db, 1, { id: 2, title: "Custom Item 2", price: 75 });

		// Get the receipt
		const receipt = await getReceiptForNote(db, 1);

		// Assert the receipt data
		expect(receipt.items).toEqual([
			{
				isbn: "1111111111",
				title: "Book 1",
				quantity: 2,
				price: expect.any(Number),
				discount: 10
			},
			{
				isbn: "2222222222",
				title: "Book 2",
				quantity: 3,
				price: expect.any(Number),
				discount: 0
			},
			{
				title: "Custom Item 1",
				quantity: 1,
				price: 50,
				discount: 0
			},
			{
				title: "Custom Item 2",
				quantity: 1,
				price: 75,
				discount: 0
			}
		]);
		expect(receipt.timestamp).toEqual(expect.any(String));
	});
});

describe("Book transactions", async () => {
	it("adds volumes to a note", async () => {
		const db = await getRandomDb();

		await createOutboundNote(db, 1);

		await addVolumesToNote(db, 1, { isbn: "1234567890", quantity: 10, warehouseId: 1 });

		expect(await getNoteEntries(db, 1)).toEqual([
			expect.objectContaining({
				isbn: "1234567890",
				quantity: 10,
				warehouseId: 1
			})
		]);

		// The DB saves updated_at with second intervals
		// Wait for a second to observe the updated_at updated between writes
		await new Promise((res) => setTimeout(res, 1000));
		await addVolumesToNote(db, 1, { isbn: "0987654321", quantity: 5, warehouseId: 1 });

		expect(await getNoteEntries(db, 1)).toEqual([
			expect.objectContaining({
				isbn: "0987654321",
				quantity: 5,
				warehouseId: 1
			}),
			expect.objectContaining({
				isbn: "1234567890",
				quantity: 10,
				warehouseId: 1
			})
		]);

		// Adding a volume without warehouseId should be possible
		//
		// The DB saves updated_at with second intervals
		// Wait for a second to observe the updated_at updated between writes
		await new Promise((res) => setTimeout(res, 1000));
		await addVolumesToNote(db, 1, { isbn: "0987654321", quantity: 5 });
		expect(await getNoteEntries(db, 1)).toEqual([
			expect.objectContaining({
				isbn: "0987654321",
				quantity: 5,
				warehouseId: undefined
			}),
			expect.objectContaining({
				isbn: "0987654321",
				quantity: 5,
				warehouseId: 1
			}),
			expect.objectContaining({
				isbn: "1234567890",
				quantity: 10,
				warehouseId: 1
			})
		]);
	});

	it("aggregates quantity for the same (isbn, noteId, warehouseId) entry", async () => {
		const db = await getRandomDb();

		await upsertWarehouse(db, { id: 1, displayName: "Warehouse 1" });
		await createInboundNote(db, 1, 1);

		await addVolumesToNote(db, 1, { isbn: "1234567890", quantity: 10, warehouseId: 1 });

		let entries = await getNoteEntries(db, 1);
		expect(entries).toEqual([
			expect.objectContaining({
				isbn: "1234567890",
				quantity: 10,
				warehouseId: 1
			})
		]);

		await addVolumesToNote(db, 1, { isbn: "1234567890", quantity: 5, warehouseId: 1 });

		entries = await getNoteEntries(db, 1);
		expect(entries).toEqual([
			expect.objectContaining({
				isbn: "1234567890",
				quantity: 15, // Aggregated quantity
				warehouseId: 1
			})
		]);
	});

	it("doesn't allow adding of volumes to a committed note (noop)", async () => {
		const db = await getRandomDb();

		await upsertWarehouse(db, { id: 1, displayName: "Warehouse 1" });
		await createInboundNote(db, 1, 1);

		// Add initial volumes
		await addVolumesToNote(db, 1, { isbn: "1234567890", quantity: 10, warehouseId: 1 });

		// Commit the note
		await commitNote(db, 1);

		// Attempt to add more volumes to the committed note
		await addVolumesToNote(db, 1, { isbn: "1234567890", quantity: 5, warehouseId: 1 });

		// Verify that the quantity has not changed
		const entries = await getNoteEntries(db, 1);
		expect(entries).toEqual([
			expect.objectContaining({
				isbn: "1234567890",
				quantity: 10, // Should remain unchanged
				warehouseId: 1
			})
		]);
	});

	it("updates note's updated_at field when an entry is added/updated", async () => {
		const db = await getRandomDb();

		await upsertWarehouse(db, { id: 1, displayName: "Warehouse 1" });
		await createInboundNote(db, 1, 1);

		let note = await getNoteById(db, 1);
		let updatedAt = note?.updatedAt;

		// The DB saves updated_at with second intervals
		// Wait for a second to observe the updated_at updated between writes
		await new Promise((res) => setTimeout(res, 1000));
		await addVolumesToNote(db, 1, { isbn: "1234567890", quantity: 10, warehouseId: 1 });

		note = await getNoteById(db, 1);
		expect(note?.updatedAt > updatedAt).toEqual(true);
		updatedAt = note?.updatedAt;

		// Add some more volumes
		//
		// The DB saves updated_at with second intervals
		// Wait for a second to observe the updated_at updated between writes
		await new Promise((res) => setTimeout(res, 1000));
		await addVolumesToNote(db, 1, { isbn: "1234567890", quantity: 5, warehouseId: 1 });

		note = await getNoteById(db, 1);
		expect(note?.updatedAt > updatedAt).toEqual(true);
		updatedAt = note?.updatedAt;

		// Should also work with txn update
		//
		// The DB saves updated_at with second intervals
		// Wait for a second to observe the updated_at updated between writes
		await new Promise((res) => setTimeout(res, 1000));
		await updateNoteTxn(db, 1, { isbn: "1234567890", warehouseId: 1 }, { quantity: 7, warehouseId: 1 });

		note = await getNoteById(db, 1);
		expect(note?.updatedAt > updatedAt).toEqual(true);
		updatedAt = note?.updatedAt;

		// Should also work when removing a txn
		//
		// The DB saves updated_at with second intervals
		// Wait for a second to observe the updated_at updated between writes
		await new Promise((res) => setTimeout(res, 1000));
		await removeNoteTxn(db, 1, { isbn: "1234567890", warehouseId: 1 });

		note = await getNoteById(db, 1);
		expect(note?.updatedAt > updatedAt).toEqual(true);
		updatedAt = note?.updatedAt;
	});

	it("retrieves note entries so that the latest updated appears first", async () => {
		const db = await getRandomDb();

		await upsertWarehouse(db, { id: 1, displayName: "Warehouse 1" });
		await createInboundNote(db, 1, 1);

		// Add multiple entries with different updated_at times
		await addVolumesToNote(db, 1, { isbn: "0987654321", quantity: 5, warehouseId: 1 });
		await new Promise((res) => setTimeout(res, 1000)); // Ensure different timestamps
		await addVolumesToNote(db, 1, { isbn: "1234567890", quantity: 10, warehouseId: 1 });
		await new Promise((res) => setTimeout(res, 1000)); // Ensure different timestamps
		await addVolumesToNote(db, 1, { isbn: "1122334455", quantity: 8, warehouseId: 1 });

		const entries = await getNoteEntries(db, 1);

		expect(entries).toEqual([
			expect.objectContaining({ isbn: "1122334455" }),
			expect.objectContaining({ isbn: "1234567890" }),
			expect.objectContaining({ isbn: "0987654321" })
		]);
	});

	it("updates a transaction", async () => {
		const db = await getRandomDb();

		await upsertWarehouse(db, { id: 1, displayName: "Warehouse 1" });
		await createInboundNote(db, 1, 1);

		await addVolumesToNote(db, 1, { isbn: "1234567890", quantity: 10, warehouseId: 1 });

		await updateNoteTxn(db, 1, { isbn: "1234567890", warehouseId: 1 }, { warehouseId: 1, quantity: 15 });

		const entries = await getNoteEntries(db, 1);
		expect(entries).toEqual([
			expect.objectContaining({
				isbn: "1234567890",
				quantity: 15,
				warehouseId: 1
			})
		]);
	});

	it("merges transactions when updating to an existing (isbn, warehouseId) pair", async () => {
		const db = await getRandomDb();

		await upsertWarehouse(db, { id: 1, displayName: "Warehouse 1" });
		await createInboundNote(db, 1, 1);

		await addVolumesToNote(db, 1, { isbn: "1234567890", quantity: 10, warehouseId: 1 });
		await addVolumesToNote(db, 1, { isbn: "1234567890", quantity: 5, warehouseId: 2 });

		await updateNoteTxn(db, 1, { isbn: "1234567890", warehouseId: 2 }, { warehouseId: 1, quantity: 5 });

		const entries = await getNoteEntries(db, 1);
		expect(entries).toEqual([
			expect.objectContaining({
				isbn: "1234567890",
				quantity: 15, // Merged quantity
				warehouseId: 1
			})
		]);
	});

	it("doesn't update transactions of a committed note (noop)", async () => {
		const db = await getRandomDb();

		await upsertWarehouse(db, { id: 1, displayName: "Warehouse 1" });
		await createInboundNote(db, 1, 1);

		await addVolumesToNote(db, 1, { isbn: "1234567890", quantity: 10, warehouseId: 1 });

		// Commit the note
		await commitNote(db, 1);

		// Attempt to update the transaction
		await updateNoteTxn(db, 1, { isbn: "1234567890", warehouseId: 1 }, { warehouseId: 1, quantity: 15 });

		// Verify that the quantity has not changed
		const entries = await getNoteEntries(db, 1);
		expect(entries).toEqual([
			expect.objectContaining({
				isbn: "1234567890",
				quantity: 10, // Should remain unchanged
				warehouseId: 1
			})
		]);
	});

	it("order of transactions stays the same when updating the txn", async () => {
		const db = await getRandomDb();

		await upsertWarehouse(db, { id: 1, displayName: "Warehouse 1" });
		await createInboundNote(db, 1, 1);

		// Add initial transactions
		await addVolumesToNote(db, 1, { isbn: "1234567890", quantity: 10, warehouseId: 1 });
		await new Promise((res) => setTimeout(res, 1000)); // Ensure different timestamps
		await addVolumesToNote(db, 1, { isbn: "0987654321", quantity: 5, warehouseId: 1 });

		// Check before updating
		expect(await getNoteEntries(db, 1)).toEqual([
			expect.objectContaining({ isbn: "0987654321" }),
			expect.objectContaining({ isbn: "1234567890" })
		]);

		// Update a transaction
		await updateNoteTxn(db, 1, { isbn: "1234567890", warehouseId: 1 }, { warehouseId: 1, quantity: 15 });

		// Verify the order remains the same
		expect(await getNoteEntries(db, 1)).toEqual([
			expect.objectContaining({ isbn: "0987654321" }),
			expect.objectContaining({ isbn: "1234567890" })
		]);
	});

	it("when two transactions are merged, they pop to the top of the list", async () => {
		const db = await getRandomDb();

		await upsertWarehouse(db, { id: 1, displayName: "Warehouse 1" });
		await createInboundNote(db, 1, 1);

		// Add initial transactions
		await addVolumesToNote(db, 1, { isbn: "1234567890", quantity: 10, warehouseId: 1 });
		await addVolumesToNote(db, 1, { isbn: "1234567890", quantity: 5, warehouseId: 2 });
		await new Promise((res) => setTimeout(res, 1000)); // Ensure different timestamps
		await addVolumesToNote(db, 1, { isbn: "0987654321", quantity: 5, warehouseId: 1 });
		expect(await getNoteEntries(db, 1)).toEqual([
			expect.objectContaining({ isbn: "0987654321" }),
			expect.objectContaining({ isbn: "1234567890" }),
			expect.objectContaining({ isbn: "1234567890" })
		]);

		// Merge transactions
		await updateNoteTxn(db, 1, { isbn: "1234567890", warehouseId: 2 }, { warehouseId: 1, quantity: 5 });

		// Verify the merged transaction pops to the top
		expect(await getNoteEntries(db, 1)).toEqual([
			expect.objectContaining({ isbn: "1234567890" }),
			expect.objectContaining({ isbn: "0987654321" })
		]);
	});

	it("removes a transaction", async () => {
		const db = await getRandomDb();

		await upsertWarehouse(db, { id: 1, displayName: "Warehouse 1" });
		await createInboundNote(db, 1, 1);

		await addVolumesToNote(db, 1, { isbn: "1234567890", quantity: 10, warehouseId: 1 });
		await addVolumesToNote(db, 1, { isbn: "0987654321", quantity: 5, warehouseId: 1 });

		// Remove a transaction
		await removeNoteTxn(db, 1, { isbn: "1234567890", warehouseId: 1 });

		// Verify the transaction is removed
		expect(await getNoteEntries(db, 1)).toEqual([
			expect.objectContaining({
				isbn: "0987654321",
				quantity: 5,
				warehouseId: 1
			})
		]);
	});

	it("doesn't allow removing a transaction from a committed note", async () => {
		const db = await getRandomDb();

		await upsertWarehouse(db, { id: 1, displayName: "Warehouse 1" });
		await createInboundNote(db, 1, 1);

		await addVolumesToNote(db, 1, { isbn: "1234567890", quantity: 10, warehouseId: 1 });

		// Commit the note
		await commitNote(db, 1);

		// Attempt to remove a transaction
		await removeNoteTxn(db, 1, { isbn: "1234567890", warehouseId: 1 });

		// Verify the transaction is not removed
		expect(await getNoteEntries(db, 1)).toEqual([
			expect.objectContaining({
				isbn: "1234567890",
				quantity: 10,
				warehouseId: 1
			})
		]);
	});

	it("allows for adding a transacion after the same one (isbn, warehouseId) had been deleted", async () => {
		/* This should be trivial, but I had some weird behaviour around this so here's a test testing that cr-sqlite extension doesn't block that. */

		// A helper to avoid flakiness due to temporal sorting - sorts by warehouseId
		const _getNoteEntries = (db: DB, noteId: number) =>
			getNoteEntries(db, noteId).then((r) => r.sort((a, b) => a.warehouseId - b.warehouseId));

		const db = await getRandomDb();

		await upsertWarehouse(db, { id: 1, displayName: "Warehouse 1" });
		await createInboundNote(db, 1, 1);

		await addVolumesToNote(db, 1, { isbn: "1234567890", quantity: 10, warehouseId: 1 });
		await addVolumesToNote(db, 1, { isbn: "1234567890", quantity: 5, warehouseId: 2 });

		// Remove a transaction and add a new one with the same (isbn, warehouseId) pair
		await removeNoteTxn(db, 1, { isbn: "1234567890", warehouseId: 1 });
		await addVolumesToNote(db, 1, { isbn: "1234567890", quantity: 7, warehouseId: 1 });

		expect(await _getNoteEntries(db, 1)).toMatchObject([
			expect.objectContaining({ isbn: "1234567890", warehouseId: 1, quantity: 7 }),
			expect.objectContaining({ isbn: "1234567890", warehouseId: 2, quantity: 5 })
		]);

		// Check again, after a txn being removed implicitly - by merging into another one
		await updateNoteTxn(db, 1, { isbn: "1234567890", warehouseId: 1 }, { warehouseId: 2, quantity: 7 });
		await addVolumesToNote(db, 1, { isbn: "1234567890", quantity: 6, warehouseId: 1 });

		expect(await _getNoteEntries(db, 1)).toMatchObject([
			expect.objectContaining({ isbn: "1234567890", warehouseId: 1, quantity: 6 }),
			expect.objectContaining({ isbn: "1234567890", warehouseId: 2, quantity: 12 })
		]);
	});
});

describe("Note custom items", async () => {
	it("adds a custom item to an outbound note", async () => {
		const db = await getRandomDb();
		await createOutboundNote(db, 1);

		let note = await getNoteById(db, 1);
		const updatedAt = note?.updatedAt;

		// The DB saves updated_at with second intervals
		// Wait for a second to observe the updated_at updated between writes
		await new Promise((res) => setTimeout(res, 1000));
		await upsertNoteCustomItem(db, 1, { id: 1, title: "Custom Item 1", price: 100 });

		const items = await getNoteCustomItems(db, 1);
		expect(items).toEqual([
			expect.objectContaining({
				id: 1,
				title: "Custom Item 1",
				price: 100
			})
		]);

		note = await getNoteById(db, 1);
		expect(note?.updatedAt > updatedAt).toEqual(true);
	});

	it("updates a custom item in an outbound note", async () => {
		const db = await getRandomDb();
		await createOutboundNote(db, 1);

		await upsertNoteCustomItem(db, 1, { id: 1, title: "Custom Item 1", price: 100 });

		let note = await getNoteById(db, 1);
		const updatedAt = note?.updatedAt;

		// The DB saves updated_at with second intervals
		// Wait for a second to observe the updated_at updated between writes
		await new Promise((res) => setTimeout(res, 1000));
		await upsertNoteCustomItem(db, 1, { id: 1, title: "Updated Custom Item 1", price: 150 });

		const items = await getNoteCustomItems(db, 1);
		expect(items).toEqual([
			expect.objectContaining({
				id: 1,
				title: "Updated Custom Item 1",
				price: 150
			})
		]);

		note = await getNoteById(db, 1);
		expect(note?.updatedAt > updatedAt).toEqual(true);
	});

	it("removes a custom item from an outbound note", async () => {
		const db = await getRandomDb();
		await createOutboundNote(db, 1);

		await upsertNoteCustomItem(db, 1, { id: 1, title: "Custom Item 1", price: 100 });

		let note = await getNoteById(db, 1);
		const updatedAt = note?.updatedAt;

		// The DB saves updated_at with second intervals
		// Wait for a second to observe the updated_at updated between writes
		await new Promise((res) => setTimeout(res, 1000));
		await removeNoteCustomItem(db, 1, 1);

		const items = await getNoteCustomItems(db, 1);
		expect(items).toEqual([]);

		note = await getNoteById(db, 1);
		expect(note?.updatedAt > updatedAt).toEqual(true);
	});

	it("doesn't allow upserting custom items to a committed note", async () => {
		const db = await getRandomDb();
		await createOutboundNote(db, 1);

		await commitNote(db, 1);

		let note = await getNoteById(db, 1);
		const updatedAt = note?.updatedAt;

		// The DB saves updated_at with second intervals
		// Wait for a second to observe the updated_at updated between writes
		await new Promise((res) => setTimeout(res, 1000));
		await upsertNoteCustomItem(db, 1, { id: 1, title: "Custom Item 1", price: 100 });

		const items = await getNoteCustomItems(db, 1);
		expect(items).toEqual([]);

		note = await getNoteById(db, 1);
		expect(note?.updatedAt).toEqual(updatedAt);
	});

	it("doesn't allow removing custom items from a committed note", async () => {
		const db = await getRandomDb();
		await createOutboundNote(db, 1);

		await upsertNoteCustomItem(db, 1, { id: 1, title: "Custom Item 1", price: 100 });
		await commitNote(db, 1);

		let note = await getNoteById(db, 1);
		const updatedAt = note?.updatedAt;

		// The DB saves updated_at with second intervals
		// Wait for a second to observe the updated_at updated between writes
		await new Promise((res) => setTimeout(res, 1000));
		await removeNoteCustomItem(db, 1, 1);

		note = await getNoteById(db, 1);
		expect(note?.updatedAt).toEqual(updatedAt);

		const items = await getNoteCustomItems(db, 1);
		expect(items).toEqual([
			expect.objectContaining({
				id: 1,
				title: "Custom Item 1",
				price: 100
			})
		]);
	});

	it("doesn't take into account custom items added to different note(s)", async () => {
		const db = await getRandomDb();
		await createOutboundNote(db, 1);
		await createOutboundNote(db, 2);

		await upsertNoteCustomItem(db, 1, { id: 1, title: "Item 1", price: 10 });
		await upsertNoteCustomItem(db, 2, { id: 1, title: "Item 2", price: 12 });

		expect(await getNoteCustomItems(db, 1)).toEqual([{ id: 1, title: "Item 1", price: 10 }]);
		expect(await getNoteCustomItems(db, 2)).toEqual([{ id: 1, title: "Item 2", price: 12 }]);
	});
});

import { createAndCommitReconciliationNote } from "../note";

describe("Reconciliation note", () => {
	it("creates and commits the reconciliation note (along with respective transactions)", async () => {
		const db = await getRandomDb();
		const volumes = [
			{ isbn: "1234567890", quantity: 5, warehouseId: 1 },
			{ isbn: "0987654321", quantity: 10, warehouseId: 2 }
		];

		await createAndCommitReconciliationNote(db, 1, volumes);

		const note = await getNoteById(db, 1);
		expect(note).toEqual(
			expect.objectContaining({
				id: 1,
				displayName: expect.stringContaining("Reconciliation note:"),
				isReconciliationNote: true,
				committed: true,
				committedAt: expect.any(Date),
				updatedAt: expect.any(Date)
			})
		);
		expect(note.committedAt).toEqual(note.updatedAt);
		expect(note.displayName).toEqual(`Reconciliation note: ${note.committedAt.toISOString()}`);

		const { committedAt } = note;

		// TODO: this is tested somewhat explicitly for now, when we add stock functionality, test (implicitly) for stock state
		const transactionsQuery = "SELECT isbn, quantity, warehouse_id, committed_at, updated_at FROM book_transaction WHERE note_id = 1";
		const transactions = await db
			.execO<{ isbn: string; quantity: number; warehouseId: number; updated_at: number; committed_at: number }>(transactionsQuery)
			.then((x) =>
				x.map(({ committed_at, updated_at, ...item }) => ({
					...item,
					committedAt: new Date(committed_at),
					updatedAt: new Date(updated_at)
				}))
			);
		expect(transactions).toEqual([
			{ isbn: "1234567890", quantity: 5, warehouse_id: 1, committedAt, updatedAt: committedAt },
			{ isbn: "0987654321", quantity: 10, warehouse_id: 2, committedAt, updatedAt: committedAt }
		]);

		// Check for updated_at consistency
		expect(note.updatedAt).toEqual(note.committedAt);
	});
});
