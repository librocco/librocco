/**
 * @fileoverview Client-version gate for the sync WebSocket server (Linear D-609)
 *
 * Clients announce their build version as a `client_version` query parameter on
 * the sync WebSocket URL. The gate runs as the `authenticate` hook of
 * `attachWebsocketServer`, so a denied client is refused at the HTTP upgrade
 * (401) before any sync protocol runs - it can neither push nor pull changes.
 *
 * Why: fixes like the per-site id allocation (D-595) are only safe when the
 * whole fleet runs them; a single stale tab silently corrupts shared CRDT data.
 * Listing the bad build here turns "remember to reload every till" into an
 * enforced invariant, and doubles as an incident-response lever (quarantine a
 * bad build without touching the shop machines).
 *
 * Configuration: `DENIED_CLIENT_VERSIONS` - comma-separated version tokens
 * (the client's embedded git SHA). The special token `unversioned` denies
 * clients that predate version announcement (they send no `client_version`).
 * An empty/unset list admits everyone, including unversioned clients.
 */

import type { IncomingMessage } from "http";

import { parseSecHeader } from "@vlcn.io/ws-server";

/** Deny-list token matching clients that don't announce a version at all */
export const UNVERSIONED = "unversioned";

/** Parses the DENIED_CLIENT_VERSIONS env value into a set of version tokens */
export function parseDeniedClientVersions(raw: string | undefined): Set<string> {
	return new Set(
		(raw ?? "")
			.split(",")
			.map((v) => v.trim())
			.filter(Boolean)
	);
}

/** Extracts the `client_version` query parameter from a request url (e.g. "/sync?client_version=abc123") */
export function extractClientVersion(requestUrl: string | undefined): string | null {
	if (!requestUrl) return null;
	// request.url is server-relative; any base makes it parseable
	try {
		const version = new URL(requestUrl, "http://localhost").searchParams.get("client_version");
		return version || null;
	} catch {
		return null;
	}
}

/** Best-effort room (db name) extraction from the ws subprotocol header, for logging only */
function extractRoom(req: IncomingMessage): string {
	try {
		const proto = req.headers["sec-websocket-protocol"];
		return (proto && parseSecHeader(proto).room) || "<unknown>";
	} catch {
		return "<unknown>";
	}
}

type AuthenticateFn = (req: IncomingMessage, token: string | null, cb: (err: any) => void) => void;

/**
 * Builds the `authenticate` hook for `attachWebsocketServer`: logs every
 * connection's announced version and denies connections whose version is on
 * the deny list (or which announce none, when the list contains `unversioned`).
 */
export function makeVersionGate(denied: Set<string>): AuthenticateFn {
	return (req, _token, cb) => {
		const version = extractClientVersion(req.url);
		const room = extractRoom(req);
		const label = version ?? UNVERSIONED;

		if (denied.has(label)) {
			console.warn(`[version-gate] DENIED connection to '${room}' from client version '${label}'`);
			cb(new Error(`client version '${label}' is denied`));
			return;
		}

		console.log(`[version-gate] connection to '${room}' from client version '${label}'`);
		cb(null);
	};
}
