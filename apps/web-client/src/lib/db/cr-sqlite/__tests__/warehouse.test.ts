import { describe, it, expect } from "vitest";

import { getRandomDb } from "./lib";

import { upsertWarehouse, getAllWarehouses, getWarehouseById, getWarehouseIdSeq, deleteWarehouse } from "../warehouse";
import { addVolumesToNote, createAndCommitReconciliationNote, createInboundNote, createOutboundNote, commitNote, getNoteEntries } from "../note";
import { getStock } from "../stock";

describe("Warehouse tests", () => {
	it("creates a new warehouse, using only id, with default fields", async () => {
		const db = await getRandomDb();

		await upsertWarehouse(db, { id: 1 });

		const res = await getAllWarehouses(db);
		expect(res).toEqual([{ id: 1, displayName: "New Warehouse", discount: 0, totalBooks: 0 }]);
	});

	it("creates a new warehouse with full provided values", async () => {
		const db = await getRandomDb();

		await upsertWarehouse(db, { id: 1, displayName: "Central Warehouse", discount: 10 });

		const res = await getAllWarehouses(db);
		expect(res).toEqual([{ id: 1, displayName: "Central Warehouse", discount: 10, totalBooks: 0 }]);
	});

	it("updates single values in a predictable way", async () => {
		const db = await getRandomDb();

		// Insert initial warehouse
		await upsertWarehouse(db, { id: 1, displayName: "Old Name", discount: 5 });

		// Update display name
		await upsertWarehouse(db, { id: 1, displayName: "New Warehouse" });

		expect(await getWarehouseById(db, 1)).toEqual({ id: 1, displayName: "New Warehouse", discount: 5 });

		// Update discount
		await upsertWarehouse(db, { id: 1, discount: 15 });
		expect(await getWarehouseById(db, 1)).toEqual({ id: 1, displayName: "New Warehouse", discount: 15 });
	});

	it("assigns default warehouse name continuing the sequence", async () => {
		const db = await getRandomDb();

		// Create warehouse 1, default name should be 'New Warehouse'
		await upsertWarehouse(db, { id: 1 });
		let res = await getAllWarehouses(db);
		expect(res).toEqual([{ id: 1, displayName: "New Warehouse", discount: 0, totalBooks: 0 }]);

		// Create warehouse 2, default name should be 'New Warehouse (2)'
		await upsertWarehouse(db, { id: 2 });
		res = await getAllWarehouses(db);
		expect(res).toEqual([
			{ id: 1, displayName: "New Warehouse", discount: 0, totalBooks: 0 },
			{ id: 2, displayName: "New Warehouse (2)", discount: 0, totalBooks: 0 }
		]);

		// Rename warehouse 1 to 'Warehouse 1'
		await upsertWarehouse(db, { id: 1, displayName: "Warehouse 1" });
		res = await getAllWarehouses(db);
		expect(res).toEqual([
			{ id: 1, displayName: "Warehouse 1", discount: 0, totalBooks: 0 },
			{ id: 2, displayName: "New Warehouse (2)", discount: 0, totalBooks: 0 }
		]);

		// Create warehouse 3, default name should be 'New Warehouse (3)' (continuing the sequence)
		await upsertWarehouse(db, { id: 3 });
		res = await getAllWarehouses(db);
		expect(res).toEqual([
			{ id: 1, displayName: "Warehouse 1", discount: 0, totalBooks: 0 },
			{ id: 2, displayName: "New Warehouse (2)", discount: 0, totalBooks: 0 },
			{ id: 3, displayName: "New Warehouse (3)", discount: 0, totalBooks: 0 }
		]);

		// Rename warehouse 2 to 'Warehouse 2'
		await upsertWarehouse(db, { id: 2, displayName: "Warehouse 2" });
		// Rename warehouse 3 to 'Warehouse 3'
		await upsertWarehouse(db, { id: 3, displayName: "Warehouse 3" });
		res = await getAllWarehouses(db);
		expect(res).toEqual([
			{ id: 1, displayName: "Warehouse 1", discount: 0, totalBooks: 0 },
			{ id: 2, displayName: "Warehouse 2", discount: 0, totalBooks: 0 },
			{ id: 3, displayName: "Warehouse 3", discount: 0, totalBooks: 0 }
		]);

		// Create warehouse 4, default name should be 'New Warehouse' (restarting the sequence)
		await upsertWarehouse(db, { id: 4 });
		res = await getAllWarehouses(db);
		expect(res).toEqual([
			{ id: 1, displayName: "Warehouse 1", discount: 0, totalBooks: 0 },
			{ id: 2, displayName: "Warehouse 2", discount: 0, totalBooks: 0 },
			{ id: 3, displayName: "Warehouse 3", discount: 0, totalBooks: 0 },
			{ id: 4, displayName: "New Warehouse", discount: 0, totalBooks: 0 }
		]);
	});

	it("deletes a warehouse", async () => {
		const db = await getRandomDb();

		// Create a warehouse
		await upsertWarehouse(db, { id: 1, displayName: "Warehouse to Delete" });

		// Verify the warehouse exists
		let res = await getAllWarehouses(db);
		expect(res).toEqual([{ id: 1, displayName: "Warehouse to Delete", discount: 0, totalBooks: 0 }]);

		// Delete the warehouse
		await deleteWarehouse(db, 1);

		// Verify the warehouse is deleted
		res = await getAllWarehouses(db);
		expect(res).toEqual([]);
	});

	it("deleting a warehouse removes its stock symmetrically, leaving no phantom negative stock", async () => {
		const db = await getRandomDb();

		await upsertWarehouse(db, { id: 1, displayName: "Warehouse A" });
		await upsertWarehouse(db, { id: 2, displayName: "Warehouse B" });

		// Same ISBN stocked in both warehouses
		await createInboundNote(db, 1, 1);
		await addVolumesToNote(db, 1, { isbn: "1111111111", quantity: 10, warehouseId: 1 });
		await commitNote(db, 1);

		await createInboundNote(db, 2, 2);
		await addVolumesToNote(db, 2, { isbn: "1111111111", quantity: 5, warehouseId: 2 });
		await commitNote(db, 2);

		// A committed sale sourced from warehouse 1. Its book_transaction carries warehouse_id = 1
		// while the (outbound) note has warehouse_id IS NULL, so it counts as -3 against warehouse 1.
		// Warehouse 1 nets 10 - 3 = 7; warehouse 2 holds 5.
		await createOutboundNote(db, 3);
		await addVolumesToNote(db, 3, { isbn: "1111111111", quantity: 3, warehouseId: 1 });
		await commitNote(db, 3);

		await deleteWarehouse(db, 1);

		const stock = await getStock(db);

		// All of warehouse 1's legs (the +10 inbound AND the -3 outbound) must be removed together.
		// Only warehouse 2's 5 should remain.
		expect(stock).toEqual([expect.objectContaining({ isbn: "1111111111", warehouseId: 2, quantity: 5 })]);

		// The bug: the outbound leg is reassigned to the sentinel warehouse 0 instead of being
		// removed, leaving a phantom { warehouseId: 0, quantity: -3 } behind.
		expect(stock.some((s) => s.quantity < 0)).toBe(false);
		expect(stock.some((s) => s.warehouseId === 0)).toBe(false);
	});

	it("deleting a warehouse unassigns (rather than deletes) draft outbound lines pointing to it", async () => {
		const db = await getRandomDb();

		await upsertWarehouse(db, { id: 1, displayName: "Warehouse A" });

		await createInboundNote(db, 1, 1);
		await addVolumesToNote(db, 1, { isbn: "1111111111", quantity: 10, warehouseId: 1 });
		await commitNote(db, 1);

		// An open (uncommitted) outbound note with a line sourced from warehouse 1
		await createOutboundNote(db, 2);
		await addVolumesToNote(db, 2, { isbn: "1111111111", quantity: 3, warehouseId: 1 });

		await deleteWarehouse(db, 1);

		// The draft line survives, but is unassigned (sentinel warehouse 0) so the user can re-pick.
		// Deleting it outright would silently discard work-in-progress.
		const entries = await getNoteEntries(db, 2);
		expect(entries).toEqual([expect.objectContaining({ isbn: "1111111111", quantity: 3, warehouseId: 0 })]);

		// Drafts don't count toward stock, so nothing should be left over.
		expect(await getStock(db)).toEqual([]);
	});

	it("reflects the total stock in each respective warehouse", async () => {
		const db = await getRandomDb();

		// Create two warehouses
		await upsertWarehouse(db, { id: 1, displayName: "Warehouse A" });
		await upsertWarehouse(db, { id: 2, displayName: "Warehouse B" });

		// Add stock to both warehouses
		await createInboundNote(db, 1, 1);
		await addVolumesToNote(db, 1, { isbn: "1234567890", quantity: 10, warehouseId: 1 });
		await addVolumesToNote(db, 1, { isbn: "0987654321", quantity: 20, warehouseId: 1 });
		await addVolumesToNote(db, 1, { isbn: "1111111111", quantity: 20, warehouseId: 1 });
		await commitNote(db, 1);

		await createInboundNote(db, 2, 2);
		await addVolumesToNote(db, 2, { isbn: "0987654321", quantity: 30, warehouseId: 2 });
		await commitNote(db, 2);

		// Add some reconciled stock (as to not leave out the reconciliation functionality effect)
		await createAndCommitReconciliationNote(db, 3, [{ isbn: "1111111111", quantity: 10, warehouseId: 1 }]);

		// Remove some stock
		await createOutboundNote(db, 4);
		await addVolumesToNote(db, 4, { isbn: "1234567890", quantity: 7, warehouseId: 1 });
		await addVolumesToNote(db, 4, { isbn: "0987654321", quantity: 5, warehouseId: 1 });
		await addVolumesToNote(db, 4, { isbn: "1111111111", quantity: 30, warehouseId: 1 });
		await addVolumesToNote(db, 4, { isbn: "0987654321", quantity: 20, warehouseId: 2 });
		await commitNote(db, 4);

		// Retrieve the list and check totalBooks
		expect(await getAllWarehouses(db)).toEqual([
			{ id: 1, displayName: "Warehouse A", discount: 0, totalBooks: 18 },
			{ id: 2, displayName: "Warehouse B", discount: 0, totalBooks: 10 }
		]);

		// Non committed notes aren't taken into account
		await createInboundNote(db, 1, 5);
		await addVolumesToNote(db, 5, { isbn: "1234567890", quantity: 10, warehouseId: 1 });

		await createOutboundNote(db, 6);
		await addVolumesToNote(db, 6, { isbn: "1234567890", quantity: 15, warehouseId: 1 });

		expect(await getAllWarehouses(db)).toEqual([
			{ id: 1, displayName: "Warehouse A", discount: 0, totalBooks: 18 },
			{ id: 2, displayName: "Warehouse B", discount: 0, totalBooks: 10 }
		]);
	});

	it("regression: shows warehouse with single open note", async () => {
		// I've caught a bug where, in case of warehouse having one non-committed note with some transactions,
		// the warehouse is not shown on the list. This is due to clause:
		// 'warehouse LEFT JOIN book_transaction (...) LEFT JOIN note (...) WHERE note.committed = 1 OR note.committed IS NULL'
		// and since all resulting rows were joined with transactions, there was no NULL committed value, yet no committed note/txn would omit the
		// warehouse from the list.
		const db = await getRandomDb();

		await upsertWarehouse(db, { id: 1 });
		expect(await getAllWarehouses(db)).toEqual([expect.objectContaining({ id: 1 })]);

		// Add some non-committed txns (this is where the bug happened)
		await createInboundNote(db, 1, 1);
		await addVolumesToNote(db, 1, { isbn: "1111111111", quantity: 1, warehouseId: 1 });

		expect(await getAllWarehouses(db)).toEqual([expect.objectContaining({ id: 1 })]);
	});

	it("retrieves a warehouse id seq", async () => {
		const db = await getRandomDb();

		await upsertWarehouse(db, { id: await getWarehouseIdSeq(db) });
		await upsertWarehouse(db, { id: await getWarehouseIdSeq(db) });

		expect(await getAllWarehouses(db)).toEqual([expect.objectContaining({ id: 1 }), expect.objectContaining({ id: 2 })]);
	});
});
