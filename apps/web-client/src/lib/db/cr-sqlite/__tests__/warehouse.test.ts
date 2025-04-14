import { describe, it, expect } from "vitest";

import { getRandomDb, syncDBs } from "./lib";

import { upsertWarehouse, getAllWarehouses, getWarehouseById, getWarehouseIdSeq, deleteWarehouse } from "../warehouse";
import { addVolumesToNote, createAndCommitReconciliationNote, createInboundNote, createOutboundNote, commitNote } from "../note";

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

describe("sync", () => {
	it("keeps the stock consistent while syncing", async () => {
		const [db1, db2] = await Promise.all([getRandomDb(), getRandomDb()]);

		// Setup: create and sync a warehouse
		await upsertWarehouse(db1, { id: 1, displayName: "Warehouse A" });

		await syncDBs(db1, db2);
		await syncDBs(db2, db1);

		expect(await getAllWarehouses(db1)).toEqual([expect.objectContaining({ id: 1, displayName: "Warehouse A" })]);
		expect(await getAllWarehouses(db2)).toEqual([expect.objectContaining({ id: 1, displayName: "Warehouse A" })]);

		// db1 -> db2: Create a note -> sync -> commit -> sync commit
		await createInboundNote(db1, 1, 1);
		await addVolumesToNote(db1, 1, { isbn: "1111111111", quantity: 10, warehouseId: 1 });
		await syncDBs(db1, db2);
		// Commit
		await commitNote(db1, 1);
		await syncDBs(db1, db2);

		expect(await getAllWarehouses(db1)).toEqual([expect.objectContaining({ id: 1, displayName: "Warehouse A", totalBooks: 10 })]);
		expect(await getAllWarehouses(db2)).toEqual([expect.objectContaining({ id: 1, displayName: "Warehouse A", totalBooks: 10 })]);

		// db2 -> db1: Create a note -> commit -> sync committed
		await createInboundNote(db2, 1, 2);
		await addVolumesToNote(db2, 2, { isbn: "2222222222", quantity: 20, warehouseId: 1 });
		await commitNote(db2, 2);
		await syncDBs(db2, db1);

		expect(await getAllWarehouses(db1)).toEqual([expect.objectContaining({ id: 1, displayName: "Warehouse A", totalBooks: 30 })]);
		expect(await getAllWarehouses(db2)).toEqual([expect.objectContaining({ id: 1, displayName: "Warehouse A", totalBooks: 30 })]);

		// db1 -> db2: Create + commit (reconciliation note + outbound note) -> sync
		await createAndCommitReconciliationNote(db1, 3, [{ isbn: "1111111111", quantity: 5, warehouseId: 1 }]);
		await createOutboundNote(db1, 4);
		await addVolumesToNote(db1, 4, { isbn: "1111111111", quantity: 15, warehouseId: 1 });
		await addVolumesToNote(db1, 4, { isbn: "2222222222", quantity: 15, warehouseId: 1 });
		await commitNote(db1, 4);
		await syncDBs(db1, db2);

		expect(await getAllWarehouses(db1)).toEqual([expect.objectContaining({ id: 1, displayName: "Warehouse A", totalBooks: 5 })]);
		expect(await getAllWarehouses(db2)).toEqual([expect.objectContaining({ id: 1, displayName: "Warehouse A", totalBooks: 5 })]);

		// I could go on...but I think this does it...
	});
});
