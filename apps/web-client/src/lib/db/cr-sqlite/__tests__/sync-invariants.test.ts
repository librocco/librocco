/**
 * Sync invariant + property tests.
 *
 * Unlike a single hand-built scenario, these drive the REAL librocco operations
 * (warehouse.ts / note.ts / stock.ts) across two synced cr-sqlite peers and assert
 * GENERAL invariants that must hold no matter what sequence of operations or sync
 * interleavings occur:
 *
 *   INV-1  getStock never surfaces a negative quantity (physical stock is never < 0).
 *   INV-2  After syncing to quiescence, both peers agree on stock (convergence).
 *
 * This is the forward-looking guard: it catches the class of "a converged-but-invalid
 * state leaks negative stock to the UI" — including the D-217/D-293 warehouse-deletion
 * bug — rather than pinning one known reproduction. The deterministic scenario encodes
 * the incident; the seeded fuzz explores interleavings no one wrote by hand.
 *
 * Related: D-217 (incident), D-293 (deleteWarehouse PK rewrite), D-297 (sim harness).
 */

import { describe, it, expect } from "vitest";

import { getRandomDbs } from "./lib";
import { getChanges, applyChanges } from "../db";
import { upsertWarehouse, deleteWarehouse } from "../warehouse";
import { createInboundNote, createOutboundNote, addVolumesToNote, commitNote } from "../note";
import { getStock } from "../stock";
import { OutOfStockError, NoWarehouseSelectedError } from "../errors";
import type { DBAsync } from "../types";

type StockTriple = { isbn: string; warehouseId: number; quantity: number };

// Full-send bidirectional merge until quiescence. We deliberately send ALL local
// changes (since=0) rather than use a watermark: cr-sqlite merge is idempotent, so
// this is robustly convergent and independent of any watermark optimisation.
const syncToQuiescence = async (a: DBAsync, b: DBAsync, rounds = 2) => {
	for (let i = 0; i < rounds; i++) {
		await applyChanges(b, await getChanges(a, 0n));
		await applyChanges(a, await getChanges(b, 0n));
	}
};

const stockTriples = async (db: DBAsync): Promise<StockTriple[]> =>
	(await getStock(db))
		.map(({ isbn, warehouseId, quantity }) => ({ isbn, warehouseId, quantity }))
		.sort((x, y) => x.isbn.localeCompare(y.isbn) || x.warehouseId - y.warehouseId);

const assertNoNegativeStock = async (db: DBAsync, label: string) => {
	const negatives = (await stockTriples(db)).filter((s) => s.quantity < 0);
	expect(negatives, `${label}: getStock surfaced negative quantities`).toEqual([]);
};

const assertConverged = async (a: DBAsync, b: DBAsync) => {
	expect(await stockTriples(a)).toEqual(await stockTriples(b));
};

// Deterministic seeded PRNG so failures are reproducible from the seed.
const mulberry32 = (seed: number) => () => {
	seed |= 0;
	seed = (seed + 0x6d2b79f5) | 0;
	let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
	t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
	return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

describe("sync invariants", () => {
	it("deleteWarehouse never surfaces negative stock, and peers converge (incident D-217 / D-293)", async () => {
		const [A, B] = await getRandomDbs();
		const isbn = "9788805078653";

		// Seed on A: warehouse with committed inbound +5 and a committed outbound sale -2.
		await upsertWarehouse(A, { id: 1, displayName: "Scolastica 2025" });
		await createInboundNote(A, /* warehouseId */ 1, /* noteId */ 1);
		await addVolumesToNote(A, 1, { isbn, quantity: 5, warehouseId: 1 });
		await commitNote(A, 1);
		await createOutboundNote(A, 2);
		await addVolumesToNote(A, 2, { isbn, quantity: 2, warehouseId: 1 });
		await commitNote(A, 2);

		await syncToQuiescence(A, B);

		// Pre-condition: both peers see +3 at warehouse 1.
		expect(await stockTriples(A)).toEqual([{ isbn, warehouseId: 1, quantity: 3 }]);
		await assertConverged(A, B);

		// Delete the warehouse on A. Its inbound (+5) rows are removed and the outbound
		// sale line is relocated to "no warehouse" (wh 0), leaving an unbalanced -2 there.
		await deleteWarehouse(A, 1);
		await syncToQuiescence(A, B);

		// INV-1: the -2 at wh 0 must NOT be surfaced to the UI on either peer.
		await assertNoNegativeStock(A, "A");
		await assertNoNegativeStock(B, "B");
		// INV-2: peers converge.
		await assertConverged(A, B);
	}, 30_000);

	it("fuzz: random operations across two peers never surface negative stock and converge", async () => {
		const SEED = 0xc0ffee;
		const ITERATIONS = 24;
		const rng = mulberry32(SEED);
		const pick = <T>(arr: T[]): T => arr[Math.floor(rng() * arr.length)];
		const randint = (lo: number, hi: number) => lo + Math.floor(rng() * (hi - lo + 1));

		const [A, B] = await getRandomDbs();
		const peers = [A, B];
		const isbns = ["111", "222", "333"];

		// Pre-create three warehouses on A and sync, so both peers start aligned.
		const live = new Set<number>([1, 2, 3]);
		for (const id of live) await upsertWarehouse(A, { id, displayName: `Warehouse ${id}` });
		await syncToQuiescence(A, B);

		let nextNote = 1;
		const liveArr = () => [...live];

		for (let i = 0; i < ITERATIONS; i++) {
			const roll = rng();
			const peer = pick(peers);

			if (roll < 0.4 && live.size) {
				// inbound: add committed stock
				const wh = pick(liveArr());
				const note = nextNote++;
				await createInboundNote(peer, wh, note);
				await addVolumesToNote(peer, note, { isbn: pick(isbns), quantity: randint(1, 5), warehouseId: wh });
				await commitNote(peer, note);
			} else if (roll < 0.7 && live.size) {
				// outbound: sell (may oversell vs this peer's local view — that's the point)
				const wh = pick(liveArr());
				const note = nextNote++;
				await createOutboundNote(peer, note);
				await addVolumesToNote(peer, note, { isbn: pick(isbns), quantity: randint(1, 3), warehouseId: wh });
				try {
					await commitNote(peer, note);
				} catch (e) {
					// OutOfStock / NoWarehouse are the guards working as intended — skip.
					if (!(e instanceof OutOfStockError) && !(e instanceof NoWarehouseSelectedError)) throw e;
				}
			} else if (roll < 0.8 && live.size > 1) {
				// delete a warehouse (the divergence/negative generator)
				const wh = pick(liveArr());
				await deleteWarehouse(peer, wh);
				live.delete(wh);
			} else {
				// sync
				await syncToQuiescence(A, B);
			}
		}

		await syncToQuiescence(A, B);

		await assertNoNegativeStock(A, `A (seed ${SEED})`);
		await assertNoNegativeStock(B, `B (seed ${SEED})`);
		await assertConverged(A, B);
	}, 60_000);
});
