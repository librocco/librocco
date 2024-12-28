import { describe, it, expect } from "vitest";

import { getRandomDb } from "./lib";

import { upsertBook } from "../books";
import { upsertWarehouse } from "../warehouse";
import { getStock } from "../stock";
import { addVolumesToNote, createInboundNote, createOutboundNote, commitNote, createAndCommitReconciliationNote } from "../note";

// TODO: add tests here
describe("Stock integration tests", async () => {
	it("takes into account only the committed notes", async () => {
		const db = await getRandomDb();

		//  create a warehouse
		await upsertWarehouse(db, { id: 1, displayName: "Warehouse 1" });

		//  create an inbound note, add txns, commit
		await createInboundNote(db, 1, 1);
		await addVolumesToNote(db, 1, { isbn: "1111111111", quantity: 3, warehouseId: 1 });
		await addVolumesToNote(db, 1, { isbn: "2222222222", quantity: 8, warehouseId: 1 });
		await commitNote(db, 1);

		//  getStock should reflect the state
		expect(await getStock(db)).toEqual([
			expect.objectContaining({ isbn: "1111111111", quantity: 3, warehouseId: 1 }),
			expect.objectContaining({ isbn: "2222222222", quantity: 8, warehouseId: 1 })
		]);

		//  create another inbound note, add txns, don't commit
		await createInboundNote(db, 1, 2);
		await addVolumesToNote(db, 2, { isbn: "1111111111", quantity: 2, warehouseId: 1 });
		await addVolumesToNote(db, 2, { isbn: "2222222222", quantity: 2, warehouseId: 1 });

		//  getStock should reflect the same state as after the 1st note
		expect(await getStock(db)).toEqual([
			expect.objectContaining({ isbn: "1111111111", quantity: 3, warehouseId: 1 }),
			expect.objectContaining({ isbn: "2222222222", quantity: 8, warehouseId: 1 })
		]);
	});

	it("calculates stock with respect to inbound/outbound notes", async () => {
		const db = await getRandomDb();

		// create a warehouse
		await upsertWarehouse(db, { id: 1, displayName: "Warehouse 1" });

		// create an inbound note, add txns, commit
		await createInboundNote(db, 1, 1);
		await addVolumesToNote(db, 1, { isbn: "1111111111", quantity: 10, warehouseId: 1 });
		await commitNote(db, 1);

		// create an outbound note, add txns, commit
		await createOutboundNote(db, 2);
		await addVolumesToNote(db, 2, { isbn: "1111111111", quantity: 5, warehouseId: 1 });
		await commitNote(db, 2);

		// getStock should reflect the difference between ins and outs
		expect(await getStock(db)).toEqual([expect.objectContaining({ isbn: "1111111111", quantity: 5, warehouseId: 1 })]);
	});

	it("outbound note affects multiple warehouses", async () => {
		const db = await getRandomDb();

		// create two warehouses
		await upsertWarehouse(db, { id: 1, displayName: "Warehouse 1" });
		await upsertWarehouse(db, { id: 2, displayName: "Warehouse 2" });

		// add stock to both (via respective inbound notes)
		await createInboundNote(db, 1, 1);
		await addVolumesToNote(db, 1, { isbn: "1111111111", quantity: 10, warehouseId: 1 });
		await commitNote(db, 1);

		await createInboundNote(db, 2, 2);
		await addVolumesToNote(db, 2, { isbn: "1111111111", quantity: 15, warehouseId: 2 });
		await commitNote(db, 2);

		// create an outbound note, add volumes in both warehouses, commit
		await createOutboundNote(db, 3);
		await addVolumesToNote(db, 3, { isbn: "1111111111", quantity: 5, warehouseId: 1 });
		await addVolumesToNote(db, 3, { isbn: "1111111111", quantity: 10, warehouseId: 2 });
		await commitNote(db, 3);

		// getStock should return states in both warehouses
		expect(await getStock(db)).toEqual([
			expect.objectContaining({ isbn: "1111111111", quantity: 5, warehouseId: 1 }),
			expect.objectContaining({ isbn: "1111111111", quantity: 5, warehouseId: 2 })
		]);
	});

	it("zero quantity results are omitted", async () => {
		const db = await getRandomDb();

		// create a warehouse and add some stock
		await upsertWarehouse(db, { id: 1, displayName: "Warehouse 1" });

		await createInboundNote(db, 1, 1);
		await addVolumesToNote(db, 1, { isbn: "1111111111", quantity: 5, warehouseId: 1 });
		await commitNote(db, 1);

		// create an outbound note that will result in one entry being set to 0
		await createOutboundNote(db, 2);
		await addVolumesToNote(db, 2, { isbn: "1111111111", quantity: 5, warehouseId: 1 });
		await commitNote(db, 2);

		// getStock should not return the zero quantity entry
		expect(await getStock(db)).toEqual([]);
	});

	it("reconciliation notes are counted as inbound notes", async () => {
		const db = await getRandomDb();

		// create a warehouse and add some stock
		await upsertWarehouse(db, { id: 1, displayName: "Warehouse 1" });

		await createInboundNote(db, 1, 1);
		await addVolumesToNote(db, 1, { isbn: "1111111111", quantity: 5, warehouseId: 1 });
		await commitNote(db, 1);

		// create and commit a reconciliation note
		await createAndCommitReconciliationNote(db, 2, [{ isbn: "1111111111", quantity: 5, warehouseId: 1 }]);

		// create an outbound note that will result in all volumes in a reconciliation note to be 0
		await createOutboundNote(db, 3);
		await addVolumesToNote(db, 3, { isbn: "1111111111", quantity: 10, warehouseId: 1 });
		await commitNote(db, 3);

		// getStock should not return the zero quantity entry
		expect(await getStock(db)).toEqual([]);
	});

	it("retrieves stock filtered by search string", async () => {
		const db = await getRandomDb();

		// create three books
		await upsertBook(db, { isbn: "1111111111", title: "Book One", authors: "Author A" });
		await upsertBook(db, { isbn: "2222222222", title: "Book Two", authors: "Author B" });
		await upsertBook(db, { isbn: "3333333333", title: "Another Book", authors: "Author A" });

		// create a warehouse and add some stock
		await upsertWarehouse(db, { id: 1, displayName: "Warehouse 1" });

		await createInboundNote(db, 1, 1);
		await addVolumesToNote(db, 1, { isbn: "1111111111", quantity: 5, warehouseId: 1 });
		await addVolumesToNote(db, 1, { isbn: "2222222222", quantity: 5, warehouseId: 1 });
		await addVolumesToNote(db, 1, { isbn: "3333333333", quantity: 5, warehouseId: 1 });
		await commitNote(db, 1);

		// check filtering by title string
		expect(await getStock(db, { searchString: "Book" })).toEqual([
			expect.objectContaining({ isbn: "1111111111", quantity: 5, warehouseId: 1 }),
			expect.objectContaining({ isbn: "2222222222", quantity: 5, warehouseId: 1 }),
			expect.objectContaining({ isbn: "3333333333", quantity: 5, warehouseId: 1 })
		]);

		// check filtering by author string
		expect(await getStock(db, { searchString: "Author A" })).toEqual([
			expect.objectContaining({ isbn: "1111111111", quantity: 5, warehouseId: 1 }),
			expect.objectContaining({ isbn: "3333333333", quantity: 5, warehouseId: 1 })
		]);

		// check filtering by isbn
		expect(await getStock(db, { searchString: "2222222222" })).toEqual([
			expect.objectContaining({ isbn: "2222222222", quantity: 5, warehouseId: 1 })
		]);
	});

	it.only("filters by isbn values if provided", async () => {
		const db = await getRandomDb();

		// create a warehouse and add some stock
		await upsertWarehouse(db, { id: 1, displayName: "Warehouse 1" });
		await upsertWarehouse(db, { id: 2, displayName: "Warehouse 2" });
		await upsertWarehouse(db, { id: 3, displayName: "Warehouse 3" });

		// add stock to both warehouses
		await createInboundNote(db, 1, 1);
		await addVolumesToNote(db, 1, { isbn: "1111111111", quantity: 10, warehouseId: 1 });
		await commitNote(db, 1);

		await createInboundNote(db, 2, 2);
		await addVolumesToNote(db, 2, { isbn: "1111111111", quantity: 15, warehouseId: 2 });
		await addVolumesToNote(db, 2, { isbn: "2222222222", quantity: 15, warehouseId: 2 });
		await commitNote(db, 2);

		await createInboundNote(db, 3, 3);
		await addVolumesToNote(db, 3, { isbn: "3333333333", quantity: 5, warehouseId: 3 });
		await addVolumesToNote(db, 3, { isbn: "2222222222", quantity: 10, warehouseId: 3 });
		await commitNote(db, 3);

		// filter by specific (isbn, warehouseId) pair
		expect(await getStock(db, { isbns: ["2222222222", "3333333333"] })).toEqual([
			expect.objectContaining({ isbn: "2222222222", quantity: 15, warehouseId: 2 }),
			expect.objectContaining({ isbn: "2222222222", quantity: 10, warehouseId: 3 }),
			expect.objectContaining({ isbn: "3333333333", quantity: 5, warehouseId: 3 })
		]);

		// ensure no results for non-matching pair
		expect(await getStock(db, { isbns: ["4444444444"] })).toEqual([]);
	});

	it("filters by (isbn, warehouseId) pairs if provided", async () => {
		const db = await getRandomDb();

		// create a warehouse and add some stock
		await upsertWarehouse(db, { id: 1, displayName: "Warehouse 1" });
		await upsertWarehouse(db, { id: 2, displayName: "Warehouse 2" });

		// add stock to both warehouses
		await createInboundNote(db, 1, 1);
		await addVolumesToNote(db, 1, { isbn: "1111111111", quantity: 10, warehouseId: 1 });
		await commitNote(db, 1);

		await createInboundNote(db, 2, 2);
		await addVolumesToNote(db, 2, { isbn: "1111111111", quantity: 15, warehouseId: 2 });
		await addVolumesToNote(db, 2, { isbn: "2222222222", quantity: 15, warehouseId: 2 });
		await commitNote(db, 2);

		// filter by specific (isbn, warehouseId) pair
		expect(
			await getStock(db, {
				entries: [
					{ isbn: "1111111111", warehouseId: 1 },
					{ isbn: "2222222222", warehouseId: 2 }
				]
			})
		).toEqual([
			expect.objectContaining({ isbn: "1111111111", quantity: 10, warehouseId: 1 }),
			expect.objectContaining({ isbn: "2222222222", quantity: 15, warehouseId: 2 })
		]);

		// ensure no results for non-matching pair
		expect(await getStock(db, { entries: [{ isbn: "3333333333", warehouseId: 1 }] })).toEqual([]);
	});

	it("filters by warehouseId (if provided)", async () => {
		const db = await getRandomDb();

		// create two warehouses
		await upsertWarehouse(db, { id: 1, displayName: "Warehouse 1" });
		await upsertWarehouse(db, { id: 2, displayName: "Warehouse 2" });

		// add stock to both warehouses
		await createInboundNote(db, 1, 1);
		await addVolumesToNote(db, 1, { isbn: "1111111111", quantity: 10, warehouseId: 1 });
		await commitNote(db, 1);

		await createInboundNote(db, 1, 2);
		await addVolumesToNote(db, 2, { isbn: "1111111111", quantity: 10, warehouseId: 1 });
		await addVolumesToNote(db, 2, { isbn: "2222222222", quantity: 12, warehouseId: 1 });
		await commitNote(db, 2);

		await createInboundNote(db, 2, 3);
		await addVolumesToNote(db, 3, { isbn: "1111111111", quantity: 15, warehouseId: 2 });
		await commitNote(db, 3);

		await createOutboundNote(db, 4);
		await addVolumesToNote(db, 4, { isbn: "1111111111", quantity: 15, warehouseId: 1 });
		await addVolumesToNote(db, 4, { isbn: "2222222222", quantity: 8, warehouseId: 1 });
		await addVolumesToNote(db, 4, { isbn: "1111111111", quantity: 12, warehouseId: 2 });
		await commitNote(db, 4);

		// filter by warehouseId 1
		expect(await getStock(db, { warehouseId: 1 })).toEqual([
			expect.objectContaining({ isbn: "1111111111", quantity: 5, warehouseId: 1 }),
			expect.objectContaining({ isbn: "2222222222", quantity: 4, warehouseId: 1 })
		]);

		// filter by warehouseId 2
		expect(await getStock(db, { warehouseId: 2 })).toEqual([expect.objectContaining({ isbn: "1111111111", quantity: 3, warehouseId: 2 })]);
	});
});
