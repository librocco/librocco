import { describe, it, expect } from "vitest";

import type { DB } from "../types";

import { getRandomDb } from "./lib";

import {
	createInboundNote,
	updateNote,
	deleteNote,
	getAllInboundNotes,
	getNoteById,
	commitNote,
	addVolumesToNote,
	getNoteEntries,
	updateNoteTxn,
	removeNoteTxn
} from "../note";
import { upsertWarehouse } from "../warehouse";

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

	it("retrieves a single note by id", async () => {
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

	it("commits a note", async () => {
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

		// TODO: add additional outbound notes to verify the list only retrieves the inbound notes (when we add outbound note functionality) (skip this for now)
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

describe("Note transactions", async () => {
	it("adds volumes to a note", async () => {
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

		await addVolumesToNote(db, 1, { isbn: "0987654321", quantity: 5, warehouseId: 1 });

		entries = await getNoteEntries(db, 1);
		expect(entries).toEqual([
			expect.objectContaining({
				isbn: "1234567890",
				quantity: 10,
				warehouseId: 1
			}),
			expect.objectContaining({
				isbn: "0987654321",
				quantity: 5,
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
