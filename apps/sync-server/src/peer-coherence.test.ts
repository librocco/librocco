/**
 * Tests for the peer coherence check in the shipped ws-server artefact.
 *
 * These tests run against the *installed* @vlcn.io/ws-server package
 * (unpacked from the tarball in 3rd-party/artefacts), NOT the submodule
 * source. This catches cases where the tarball wasn't rebuilt after a
 * submodule fix — exactly the bug that shipped a broken peer coherence
 * check in 76622702.
 */

import { describe, it, expect } from "vitest";
import { checkPeerCoherence } from "@vlcn.io/ws-server/dist/ConnectionBroker.js";

/**
 * Minimal mock of the IDB interface used by checkPeerCoherence.
 */
function mockDb(siteId: Uint8Array, knownSenders: Map<string, [bigint, number]> = new Map()) {
	return {
		siteId,
		getLastSeen(sender: Uint8Array): [bigint, number] {
			const key = Buffer.from(sender).toString("hex");
			return knownSenders.get(key) ?? [0n, 0];
		}
	};
}

function siteId(hex: string): Uint8Array {
	return new Uint8Array(hex.match(/.{2}/g)!.map((b) => parseInt(b, 16)));
}

describe("checkPeerCoherence (from installed tarball)", () => {
	const serverSite = siteId("b1916ab43611490395d3bcbb129b5268");
	const clientSite = siteId("2d2267d65b6d457f9e9d43266b3663aa");
	const oldServerSite = siteId("f114b296f6724b2b93b746b5f02ad697");

	it("allows a fresh client with no sync history", () => {
		const db = mockDb(serverSite);
		const result = checkPeerCoherence(db, clientSite, []);
		expect(result).toEqual({ ok: true });
	});

	it("allows a returning client that knows the current server", () => {
		const db = mockDb(serverSite);
		const lastSeens: [Uint8Array, [bigint, number]][] = [[serverSite, [10n, 0]]];
		const result = checkPeerCoherence(db, clientSite, lastSeens);
		expect(result).toEqual({ ok: true });
	});

	it("rejects a client with stale history referencing an old server", () => {
		const db = mockDb(serverSite);
		const lastSeens: [Uint8Array, [bigint, number]][] = [[oldServerSite, [47n, 0]]];
		const result = checkPeerCoherence(db, clientSite, lastSeens);
		expect(result).toEqual({ ok: false, reason: "peer_mismatch" });
	});

	it("rejects even when server has a stale record of the client", () => {
		// This is the exact scenario that was broken: the server rebuilt its DB
		// but the client connected during a prior (broken) session, so the server
		// recorded the client's sender ID. On the next connect, serverKnowsClient
		// is true but the client's lastSeens still reference the OLD server siteId.
		// The check MUST reject this — clientKnowsServer is what matters.
		const knownSenders = new Map([[Buffer.from(clientSite).toString("hex"), [47n, 0] as [bigint, number]]]);
		const db = mockDb(serverSite, knownSenders);

		const lastSeens: [Uint8Array, [bigint, number]][] = [[oldServerSite, [47n, 0]]];
		const result = checkPeerCoherence(db, clientSite, lastSeens);
		expect(result).toEqual({ ok: false, reason: "peer_mismatch" });
	});
});
