/**
 * Regression test for the gap-recovery fix in @vlcn.io/ws-server (Linear D-302).
 *
 * Like peer-coherence.test.ts, this runs against the *installed* ws-server
 * tarball (not the submodule source), so an artefact that was rebuilt without
 * the fix — or never rebuilt — fails CI here.
 *
 * The bug: OutboundStream.reset() was a no-op. When a peer detects a gap and
 * sends RejectChanges, the server must rewind its cursor and re-send the missing
 * range; otherwise a peer that falls behind mid-connection silently and
 * permanently diverges (the mechanism behind D-217).
 */

import { test, expect } from "vitest";
import OutboundStream from "@vlcn.io/ws-server/dist/streams/OutboundStream.js";

// A crsql_changes row tuple: [table, pk, cid, val, col_version, db_version, site_id, cl, seq].
// OutboundStream only reads index 5 (db_version).
const change = (dbVersion: bigint): any => ["item", new Uint8Array([1]), "v", null, 1n, dbVersion, null, 1n, 0];

test("ws-server OutboundStream.reset() rewinds and re-sends after a peer rejects a gap (installed tarball)", () => {
	// Minimal IDB: OutboundStream only uses siteId, onChange, pullChangeset.
	const db: any = {
		siteId: new Uint8Array([0xaa, 0xbb, 0xcc, 0xdd]),
		onChange: () => () => {},
		pullChangeset: (since: readonly [bigint, number]) => [change(1n), change(2n), change(3n)].filter((c) => c[5] > since[0])
	};
	const sent: any[] = [];
	const transport: any = {
		sendChanges: (msg: any) => {
			sent.push(msg);
			return "sent";
		}
	};

	const stream = new (OutboundStream as any)(transport, db, [], new Uint8Array([1, 2, 3, 4]));
	stream.start(); // initial kickoff sends db_version 1,2,3 and advances the cursor to 3
	expect(sent).toHaveLength(1);

	// Peer only applied up to db_version 1 (batch 2/3 lost) and rejects, asking to resume from [1, 0].
	// tag 3 == tags.RejectChanges.
	stream.reset({ _tag: 3, whose: db.siteId, since: [1n, 0] });

	// Must rewind and re-send the missing changes. If reset() were still a no-op this would be 1.
	expect(sent).toHaveLength(2);
	expect(sent[1].since).toEqual([1n, 0]);
	expect(sent[1].changes.map((c: any) => c[5])).toEqual([2n, 3n]);
});
