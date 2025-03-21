import { describe, it, expect } from "vitest";
import { getRandomDb } from "./lib";
import { getPastNotes, getPastTransactions } from "../history";
import { createInboundNote, createOutboundNote, commitNote, addVolumesToNote, updateNote } from "../note";
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

describe("getPastTransactions", async () => {
	it("retrieves committed transactions for a given date", async () => {
		const db = await getRandomDb();

		// Set up warehouses
		await upsertWarehouse(db, { id: 1, displayName: "Warehouse 1", discount: 0 });
		await upsertWarehouse(db, { id: 2, displayName: "Warehouse 2", discount: 20 });

		// Set up books
		await upsertBook(db, { isbn: "1111111111", price: 10 });
		await upsertBook(db, { isbn: "2222222222", price: 20 });
		await upsertBook(db, { isbn: "4444444444", price: null });

		// Create and commit notes
		await createInboundNote(db, 1, 1);
		await updateNote(db, 1, { displayName: "Note 1" });
		await addVolumesToNote(db, 1, { isbn: "1111111111", quantity: 5, warehouseId: 1 });
		await addVolumesToNote(db, 1, { isbn: "4444444444", quantity: 4, warehouseId: 1 });

		await commitNote(db, 1);
		// This note should appear second - 10:00:00
		await db.exec("UPDATE note SET committed_at = strftime('%s', '2024-01-01T10:00:00') * 1000 WHERE id = 1");

		await createInboundNote(db, 2, 2);
		await updateNote(db, 2, { displayName: "Note 2" });
		await addVolumesToNote(db, 2, { isbn: "1111111111", quantity: 5, warehouseId: 2 });
		await addVolumesToNote(db, 2, { isbn: "2222222222", quantity: 5, warehouseId: 2 });
		await commitNote(db, 2);
		// This note should appear first - 09:00:00
		await db.exec("UPDATE note SET committed_at = strftime('%s', '2024-01-01T09:00:00') * 1000 WHERE id = 2");

		await createOutboundNote(db, 3);
		await updateNote(db, 3, { displayName: "Note 3" });
		await addVolumesToNote(db, 3, { isbn: "1111111111", quantity: 3, warehouseId: 1 });
		await commitNote(db, 3);
		// This note should appear third - 11:00:00
		await db.exec("UPDATE note SET committed_at = strftime('%s', '2024-01-01T11:00:00') * 1000 WHERE id = 3");

		// This note is not committed - shouldn't be shown in the results
		await createInboundNote(db, 1, 4);
		await updateNote(db, 4, { displayName: "Note 4" });
		await addVolumesToNote(db, 4, { isbn: "3333333333", quantity: 3, warehouseId: 1 });
		// Here as noise - non committed notes shouldn't be displayed
		await db.exec("UPDATE note SET updated_at = strftime('%s', '2024-01-01T10:00:00') * 1000 WHERE id = 4");

		// This note will be dated the day after the query date - shouldn't be shown
		await createOutboundNote(db, 5);
		await updateNote(db, 5, { displayName: "Note 5" });
		await addVolumesToNote(db, 5, { isbn: "1111111111", quantity: 2, warehouseId: 1 });
		await addVolumesToNote(db, 5, { isbn: "2222222222", quantity: 3, warehouseId: 2 });
		await addVolumesToNote(db, 5, { isbn: "2222222222", quantity: 1, warehouseId: 2 });
		await commitNote(db, 5);
		// A day late - should not be shown
		await db.exec("UPDATE note SET committed_at = strftime('%s', '2024-01-02') * 1000 WHERE id = 5");

		const transactions = await getPastTransactions(db, { startDate: new Date("2024-01-01"), endDate: new Date("2024-01-01") });

		// TODO: replace committedAt expectations with actual date, see the SQL from lines 124 -- 130
		expect(transactions.map(({ isbn, warehouseId, noteId }) => ({ isbn, warehouseId, noteId }))).toEqual([
			{
				isbn: "1111111111",
				warehouseId: 2,
				noteId: 2
			},
			{
				isbn: "2222222222",
				warehouseId: 2,
				noteId: 2
			},
			{
				isbn: "1111111111",
				warehouseId: 1,
				noteId: 1
			},
			{
				isbn: "4444444444",
				warehouseId: 1,
				noteId: 1
			},
			{
				isbn: "1111111111",
				warehouseId: 1,
				noteId: 3
			}
		]);

		expect(transactions).toEqual([
			expect.objectContaining({
				isbn: "1111111111",
				quantity: 5,
				price: 10,
				// Using any(date) as new Date(<isostring>) automatically takes the TZ into account and we don't want flakiness
				committedAt: expect.any(Date),
				warehouseId: 2,
				warehouseName: "Warehouse 2",
				discount: 20,
				noteId: 2,
				noteName: "Note 2",
				noteType: "inbound"
			}),
			expect.objectContaining({
				isbn: "2222222222",
				quantity: 5,
				price: 20,
				// Using any(date) as new Date(<isostring>) automatically takes the TZ into account and we don't want flakiness,
				committedAt: expect.any(Date),
				warehouseId: 2,
				warehouseName: "Warehouse 2",
				discount: 20,
				noteId: 2,
				noteName: "Note 2",
				noteType: "inbound"
			}),
			expect.objectContaining({
				isbn: "1111111111",
				quantity: 5,
				price: 10,
				// Using any(date) as new Date(<isostring>) automatically takes the TZ into account and we don't want flakiness,
				committedAt: expect.any(Date),
				warehouseId: 1,
				warehouseName: "Warehouse 1",
				discount: 0,
				noteId: 1,
				noteName: "Note 1",
				noteType: "inbound"
			}),
			expect.objectContaining({
				isbn: "4444444444",
				quantity: 4,
				price: 0,
				// Using any(date) as new Date(<isostring>) automatically takes the TZ into account and we don't want flakiness,
				committedAt: expect.any(Date),
				warehouseId: 1,
				warehouseName: "Warehouse 1",
				discount: 0,
				noteId: 1,
				noteName: "Note 1",
				noteType: "inbound"
			}),
			expect.objectContaining({
				isbn: "1111111111",
				quantity: 3,
				price: 10,
				// Using any(date) as new Date(<isostring>) automatically takes the TZ into account and we don't want flakiness,
				committedAt: expect.any(Date),
				warehouseId: 1,
				warehouseName: "Warehouse 1",
				discount: 0,
				noteId: 3,
				noteName: "Note 3",
				noteType: "outbound"
			})
		]);
	});

	it("retrieves committed transactions for a given isbn", async () => {
		const db = await getRandomDb();

		// Set up warehouses
		await upsertWarehouse(db, { id: 1, displayName: "Warehouse 1", discount: 0 });
		await upsertWarehouse(db, { id: 2, displayName: "Warehouse 2", discount: 20 });

		// Set up books
		await upsertBook(db, { isbn: "1111111111", price: 10 });
		await upsertBook(db, { isbn: "2222222222", price: 20 });

		// Create and commit notes

		await createInboundNote(db, 1, 1);
		await updateNote(db, 1, { displayName: "Note 1" });
		await addVolumesToNote(db, 1, { isbn: "1111111111", quantity: 5, warehouseId: 1 });
		await commitNote(db, 1);
		// Should appear third
		await db.exec("UPDATE note SET committed_at = strftime('%s', '2024-01-03') * 1000 WHERE id = 2");

		await createOutboundNote(db, 2);
		await updateNote(db, 2, { displayName: "Note 2" });
		await addVolumesToNote(db, 2, { isbn: "1111111111", quantity: 3, warehouseId: 1 });
		await commitNote(db, 2);
		// Should appear second
		await db.exec("UPDATE note SET committed_at = strftime('%s', '2024-01-02') * 1000 WHERE id = 2");

		await createInboundNote(db, 2, 3);
		await updateNote(db, 3, { displayName: "Note 3" });
		await addVolumesToNote(db, 3, { isbn: "1111111111", quantity: 5, warehouseId: 2 });
		await addVolumesToNote(db, 3, { isbn: "2222222222", quantity: 5, warehouseId: 2 });
		await commitNote(db, 3);
		// Should appear first
		await db.exec("UPDATE note SET committed_at = strftime('%s', '2024-01-01') * 1000 WHERE id = 3");

		await createOutboundNote(db, 4);
		await updateNote(db, 4, { displayName: "Note 4" });
		await addVolumesToNote(db, 4, { isbn: "1111111111", quantity: 2, warehouseId: 1 });
		await addVolumesToNote(db, 4, { isbn: "2222222222", quantity: 3, warehouseId: 2 });
		// Not committed, shouldn't be shown

		// Directly update committed_at for testing

		const transactions = await getPastTransactions(db, { isbn: "1111111111" });

		expect(transactions).toEqual([
			expect.objectContaining({
				isbn: "1111111111",
				quantity: 5,
				price: 10,
				committedAt: expect.any(Date),
				warehouseId: 2,
				warehouseName: "Warehouse 2",
				discount: 20,
				noteId: 3,
				noteName: "Note 3",
				noteType: "inbound"
			}),
			expect.objectContaining({
				isbn: "1111111111",
				quantity: 3,
				price: 10,
				committedAt: expect.any(Date),
				warehouseId: 1,
				warehouseName: "Warehouse 1",
				discount: 0,
				noteId: 2,
				noteName: "Note 2",
				noteType: "outbound"
			}),
			expect.objectContaining({
				isbn: "1111111111",
				quantity: 5,
				price: 10,
				committedAt: expect.any(Date),
				warehouseId: 1,
				warehouseName: "Warehouse 1",
				discount: 0,
				noteId: 1,
				noteName: "Note 1",
				noteType: "inbound"
			})
		]);
	});

	it("retrieves committed transactions for a warehouse id and date range", async () => {
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

		await createInboundNote(db, 1, 2);
		await addVolumesToNote(db, 2, { isbn: "1111111111", quantity: 5, warehouseId: 1 });
		await addVolumesToNote(db, 2, { isbn: "2222222222", quantity: 5, warehouseId: 1 });
		await commitNote(db, 2);

		await createInboundNote(db, 2, 3);
		await addVolumesToNote(db, 3, { isbn: "1111111111", quantity: 5, warehouseId: 2 });
		await commitNote(db, 3);

		await createOutboundNote(db, 4);
		await addVolumesToNote(db, 4, { isbn: "1111111111", quantity: 2, warehouseId: 1 });
		await addVolumesToNote(db, 4, { isbn: "2222222222", quantity: 3, warehouseId: 1 });
		await addVolumesToNote(db, 4, { isbn: "1111111111", quantity: 3, warehouseId: 2 });
		await commitNote(db, 4);

		await createOutboundNote(db, 5);
		await addVolumesToNote(db, 5, { isbn: "1111111111", quantity: 1, warehouseId: 1 });
		await addVolumesToNote(db, 5, { isbn: "1111111111", quantity: 1, warehouseId: 2 });
		await commitNote(db, 5);

		// Directly update committed_at for testing
		await db.exec("UPDATE note SET committed_at = strftime('%s', '2024-01-01') * 1000 WHERE id IN (1)");
		await db.exec("UPDATE note SET committed_at = strftime('%s', '2024-01-02') * 1000 WHERE id IN (2, 3)");
		await db.exec("UPDATE note SET committed_at = strftime('%s', '2024-01-03') * 1000 WHERE id IN (4)");
		await db.exec("UPDATE note SET committed_at = strftime('%s', '2024-01-04') * 1000 WHERE id IN (5)");

		const transactions = await getPastTransactions(db, {
			warehouseId: 1,
			startDate: new Date("2024-01-02"),
			endDate: new Date("2024-01-03")
		});

		expect(transactions).toEqual([
			expect.objectContaining({
				isbn: "1111111111",
				quantity: 5,
				price: 10,
				committedAt: expect.any(Date),
				warehouseId: 1,
				warehouseName: "Warehouse 1",
				discount: 0,
				noteId: 2,
				noteName: expect.any(String),
				noteType: "inbound"
			}),
			expect.objectContaining({
				isbn: "2222222222",
				quantity: 5,
				price: 20,
				committedAt: expect.any(Date),
				warehouseId: 1,
				warehouseName: "Warehouse 1",
				discount: 0,
				noteId: 2,
				noteName: expect.any(String),
				noteType: "inbound"
			}),
			expect.objectContaining({
				isbn: "1111111111",
				quantity: 2,
				price: 10,
				committedAt: expect.any(Date),
				warehouseId: 1,
				warehouseName: "Warehouse 1",
				discount: 0,
				noteId: 4,
				noteName: expect.any(String),
				noteType: "outbound"
			}),
			expect.objectContaining({
				isbn: "2222222222",
				quantity: 3,
				price: 20,
				committedAt: expect.any(Date),
				warehouseId: 1,
				warehouseName: "Warehouse 1",
				discount: 0,
				noteId: 4,
				noteName: expect.any(String),
				noteType: "outbound"
			})
		]);
	});

	it("retrieves committed transactions for a warehouse id, date range and note type", async () => {
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

		await createInboundNote(db, 1, 2);
		await addVolumesToNote(db, 2, { isbn: "1111111111", quantity: 5, warehouseId: 1 });
		await addVolumesToNote(db, 2, { isbn: "2222222222", quantity: 5, warehouseId: 1 });
		await commitNote(db, 2);

		await createInboundNote(db, 2, 3);
		await addVolumesToNote(db, 3, { isbn: "1111111111", quantity: 5, warehouseId: 2 });
		await commitNote(db, 3);

		await createOutboundNote(db, 4);
		await addVolumesToNote(db, 4, { isbn: "1111111111", quantity: 2, warehouseId: 1 });
		await addVolumesToNote(db, 4, { isbn: "2222222222", quantity: 3, warehouseId: 1 });
		await addVolumesToNote(db, 4, { isbn: "1111111111", quantity: 3, warehouseId: 2 });
		await commitNote(db, 4);

		await createOutboundNote(db, 5);
		await addVolumesToNote(db, 5, { isbn: "1111111111", quantity: 1, warehouseId: 1 });
		await addVolumesToNote(db, 5, { isbn: "1111111111", quantity: 1, warehouseId: 2 });
		await commitNote(db, 5);

		// Directly update committed_at for testing
		await db.exec("UPDATE note SET committed_at = strftime('%s', '2024-01-01') * 1000 WHERE id IN (1)");
		await db.exec("UPDATE note SET committed_at = strftime('%s', '2024-01-02') * 1000 WHERE id IN (2, 3)");
		await db.exec("UPDATE note SET committed_at = strftime('%s', '2024-01-03') * 1000 WHERE id IN (4)");
		await db.exec("UPDATE note SET committed_at = strftime('%s', '2024-01-04') * 1000 WHERE id IN (5)");

		const inboundTxns = await getPastTransactions(db, {
			warehouseId: 1,
			startDate: new Date("2024-01-02"),
			endDate: new Date("2024-01-03"),
			noteType: "inbound"
		});

		expect(inboundTxns).toEqual([
			expect.objectContaining({
				isbn: "1111111111",
				quantity: 5,
				price: 10,
				committedAt: expect.any(Date),
				warehouseId: 1,
				warehouseName: "Warehouse 1",
				discount: 0,
				noteId: 2,
				noteName: expect.any(String),
				noteType: "inbound"
			}),
			expect.objectContaining({
				isbn: "2222222222",
				quantity: 5,
				price: 20,
				committedAt: expect.any(Date),
				warehouseId: 1,
				warehouseName: "Warehouse 1",
				discount: 0,
				noteId: 2,
				noteName: expect.any(String),
				noteType: "inbound"
			})
		]);

		const outboundTxns = await getPastTransactions(db, {
			warehouseId: 1,
			startDate: new Date("2024-01-02"),
			endDate: new Date("2024-01-03"),
			noteType: "outbound"
		});

		expect(outboundTxns).toEqual([
			expect.objectContaining({
				isbn: "1111111111",
				quantity: 2,
				price: 10,
				committedAt: expect.any(Date),
				warehouseId: 1,
				warehouseName: "Warehouse 1",
				discount: 0,
				noteId: 4,
				noteName: expect.any(String),
				noteType: "outbound"
			}),
			expect.objectContaining({
				isbn: "2222222222",
				quantity: 3,
				price: 20,
				committedAt: expect.any(Date),
				warehouseId: 1,
				warehouseName: "Warehouse 1",
				discount: 0,
				noteId: 4,
				noteName: expect.any(String),
				noteType: "outbound"
			})
		]);
	});
});
