import { describe, it, expect } from "vitest";

import type { DBAsync } from "../types";

import { getRandomDb, getRandomDbs, syncDBs } from "./lib";

import { siteIdBlockBase, SITE_ID_BLOCK_SIZE } from "../site-id-block";
import { createInboundNote, createOutboundNote, createAndCommitReconciliationNote, getNoteIdSeq } from "../note";
import { getWarehouseIdSeq, upsertWarehouse } from "../warehouse";

const getBlockBase = async (db: DBAsync): Promise<number> => {
	const [[siteId]] = await db.execA<[Uint8Array]>("SELECT crsql_site_id()");
	return siteIdBlockBase(siteId);
};

describe("siteIdBlockBase", () => {
	it("maps any site id to a block clear of legacy ids and within safe integer range", () => {
		const zeros = new Uint8Array(16);
		expect(siteIdBlockBase(zeros)).toBe(SITE_ID_BLOCK_SIZE);

		const ones = new Uint8Array(16).fill(0xff);
		const maxBase = siteIdBlockBase(ones);
		expect(maxBase).toBe(((0xffffffff % 2 ** 20) + 1) * SITE_ID_BLOCK_SIZE);

		// The highest possible allocation stays a safe JS integer
		expect(2 ** 20 * SITE_ID_BLOCK_SIZE + SITE_ID_BLOCK_SIZE).toBeLessThan(Number.MAX_SAFE_INTEGER);
	});

	it("derives different blocks from different site id prefixes", () => {
		const a = new Uint8Array(16);
		const b = new Uint8Array(16);
		b[3] = 1;
		expect(siteIdBlockBase(a)).not.toBe(siteIdBlockBase(b));
	});
});

describe("per-site id allocation", () => {
	it("allocates note ids from the site block, ignoring legacy ids", async () => {
		const db = await getRandomDb();
		const base = await getBlockBase(db);

		expect(await getNoteIdSeq(db)).toBe(base + 1);

		// A legacy (pre-block) id doesn't shift the block-scoped sequence
		await upsertWarehouse(db, { id: 1, displayName: "Warehouse 1" });
		await createInboundNote(db, 1, 123);
		expect(await getNoteIdSeq(db)).toBe(base + 1);

		await createInboundNote(db, 1, await getNoteIdSeq(db));
		expect(await getNoteIdSeq(db)).toBe(base + 2);
	});

	it("re-allocates in-transaction when the requested note id is already taken", async () => {
		const db = await getRandomDb();
		const base = await getBlockBase(db);

		const first = await createOutboundNote(db, base + 1);
		expect(first).toBe(base + 1);

		// Same (stale) candidate id: the second create must not clobber the first note
		const second = await createOutboundNote(db, base + 1);
		expect(second).toBe(base + 2);

		const ids = await db.execO<{ id: number }>("SELECT id FROM note ORDER BY id");
		expect(ids).toEqual([{ id: base + 1 }, { id: base + 2 }]);
	});

	it("re-allocates a taken reconciliation note id and keeps its transactions attached", async () => {
		const db = await getRandomDb();
		await upsertWarehouse(db, { id: 1, displayName: "Warehouse 1" });

		const taken = await createOutboundNote(db, await getNoteIdSeq(db));
		await createAndCommitReconciliationNote(db, taken, [{ isbn: "1111111111", quantity: 2, warehouseId: 1 }]);

		const notes = await db.execO<{ id: number; is_reconciliation_note: number }>("SELECT id, is_reconciliation_note FROM note ORDER BY id");
		expect(notes.length).toBe(2);

		const reconciliation = notes.find(({ is_reconciliation_note }) => is_reconciliation_note === 1);
		expect(reconciliation.id).not.toBe(taken);

		const [txn] = await db.execO<{ note_id: number }>("SELECT note_id FROM book_transaction");
		expect(txn.note_id).toBe(reconciliation.id);
	});

	it("allocates warehouse ids from the site block", async () => {
		const db = await getRandomDb();
		const base = await getBlockBase(db);

		expect(await getWarehouseIdSeq(db)).toBe(base + 1);
		await upsertWarehouse(db, { id: await getWarehouseIdSeq(db), displayName: "Warehouse 1" });
		expect(await getWarehouseIdSeq(db)).toBe(base + 2);
	});

	it("prevents cross-device note-id collisions: two out-of-sync devices minting 'the next id' stay distinct", async () => {
		const [db1, db2] = await getRandomDbs();

		// Both devices allocate their "next id" without having seen each other's writes -
		// with the old MAX(id) + 1 allocator both would mint the same id and cr-sqlite
		// would merge the two notes into one row on sync
		const id1 = await createOutboundNote(db1, await getNoteIdSeq(db1));
		const id2 = await createOutboundNote(db2, await getNoteIdSeq(db2));
		expect(id1).not.toBe(id2);

		await syncDBs(db1, db2);
		await syncDBs(db2, db1);

		const expected = [id1, id2].sort((a, b) => a - b).map((id) => ({ id }));
		expect(await db1.execO<{ id: number }>("SELECT id FROM note ORDER BY id")).toEqual(expected);
		expect(await db2.execO<{ id: number }>("SELECT id FROM note ORDER BY id")).toEqual(expected);
	});
});
