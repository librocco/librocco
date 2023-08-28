import { test, describe, expect, vi } from "vitest";
import * as helpers from "../window-helpers";
import { listenForBooks, listenForExtension } from "../listeners";

function mockAddEventListenerExtension(eventName: string, cb: (event: MessageEvent) => void) {
	if (eventName === "message") {
		const message = new MessageEvent("message", {
			source: window,
			data: {
				message: "BOOK_FETCHER_REQ:replyFromExtension:"
			}
		});

		cb(message);
	}
}

function mockAddEventListenerBooks(eventName: string, cb: (event: MessageEvent) => void) {
	if (eventName === "message") {
		const message = new MessageEvent("message", {
			source: window,
			data: {
				message: "BOOK_FETCHER_RES:bookFetcherPlugin:",
				books: [{ title: "book-123456" }]
			}
		});

		cb(message);
	}
}

describe("book fetching listeners", () => {
	test("listenForExtension resolves to true when it receives response to ping", async () => {
		vi.spyOn(helpers, "addEventListener").mockImplementation(mockAddEventListenerExtension);

		helpers.postMessage(`BOOK_FETCHER_REQ:replyFromExtension:`);

		const ww = await listenForExtension("BOOK_FETCHER_REQ:replyFromExtension:", 1000);

		expect(ww).toEqual(true);
	});
	test("listenForBooks resolves to books when it receives response from extension", async () => {
		vi.spyOn(helpers, "addEventListener").mockImplementation(mockAddEventListenerBooks);

		helpers.postMessage(`BOOK_FETCHER_REQ:bookFetcherPlugin:`);

		const ww = await listenForBooks("BOOK_FETCHER_RES:bookFetcherPlugin:", 1000);

		expect(ww).toEqual([{ title: "book-123456" }]);
	});
});
