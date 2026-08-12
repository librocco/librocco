import { describe, it, expect } from "vitest";

import { withClientVersion } from "../sync-url";

describe("withClientVersion", () => {
	it("appends the client_version query parameter to ws/wss URLs", () => {
		expect(withClientVersion("ws://127.0.0.1:3000/sync", "abc123")).toBe("ws://127.0.0.1:3000/sync?client_version=abc123");
		expect(withClientVersion("wss://host:8433/sync", "abc123")).toBe("wss://host:8433/sync?client_version=abc123");
	});

	it("preserves existing query parameters and overwrites a stale client_version", () => {
		expect(withClientVersion("wss://host/sync?foo=bar", "abc123")).toBe("wss://host/sync?foo=bar&client_version=abc123");
		expect(withClientVersion("wss://host/sync?client_version=old", "new1")).toBe("wss://host/sync?client_version=new1");
	});

	it("returns a malformed URL untouched", () => {
		expect(withClientVersion("not a url", "abc123")).toBe("not a url");
		expect(withClientVersion("", "abc123")).toBe("");
	});
});
