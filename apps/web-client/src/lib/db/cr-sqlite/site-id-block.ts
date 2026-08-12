/**
 * @fileoverview Per-site id blocks for locally-allocated integer ids
 *
 * Note and warehouse ids used to be allocated as a device-local `MAX(id) + 1`.
 * `note`/`warehouse` are CRRs keyed on that plain integer, so whenever two
 * devices minted the same "next id" (sync lag, offline work), cr-sqlite merged
 * two different business documents into one row, column by column.
 *
 * Instead, each site now allocates ids from its own block of the integer
 * space, derived from the local `crsql_site_id`. Blocks are `2^32` wide and
 * start at `2^32` or above, so:
 * - two sites with different blocks can never mint the same id
 * - legacy ids (all far below `2^32`) can never fall inside any block
 * - the highest possible id (`(2^20 + 1) * 2^32`) stays well below
 *   `Number.MAX_SAFE_INTEGER` (`2^53 - 1`)
 *
 * Two sites can still end up sharing a block if the leading 4 bytes of their
 * (random) site ids collide modulo 2^20 (~1-in-a-million per pair) - in that
 * case behavior degrades to the old status quo rather than breaking.
 */

import type { TXAsync } from "./types";

/** Width of each per-site id block */
export const SITE_ID_BLOCK_SIZE = 2 ** 32;

/** Number of distinct blocks the site id hashes into */
const SITE_ID_BLOCK_COUNT = 2 ** 20;

/**
 * Derives the base of a site's id block from the raw `crsql_site_id` bytes.
 * The block spans `(base, base + SITE_ID_BLOCK_SIZE]` - allocation starts at
 * `base + 1`.
 */
export function siteIdBlockBase(siteId: Uint8Array): number {
	const hash = new DataView(siteId.buffer, siteId.byteOffset, siteId.byteLength).getUint32(0);
	return ((hash % SITE_ID_BLOCK_COUNT) + 1) * SITE_ID_BLOCK_SIZE;
}

/**
 * Allocates the next id for `table` from this site's block: block-scoped
 * `MAX(id) + 1`, starting at the block base + 1 when the block is empty.
 *
 * NOTE: the read is only atomic with the subsequent INSERT when both run
 * inside the same transaction - callers creating rows should re-check the id
 * in-transaction (see `createInboundNote`/`createOutboundNote` in `note.ts`).
 */
export async function nextSiteScopedId(db: TXAsync, table: "note" | "warehouse"): Promise<number> {
	const [[siteId]] = await db.execA<[Uint8Array]>("SELECT crsql_site_id()");
	const base = siteIdBlockBase(siteId);
	const [result] = await db.execO<{ nextId: number }>(`SELECT COALESCE(MAX(id), ?) + 1 AS nextId FROM ${table} WHERE id > ? AND id <= ?`, [
		base,
		base,
		base + SITE_ID_BLOCK_SIZE
	]);
	return result.nextId;
}
