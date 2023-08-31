import { test, describe, expect, vi } from "vitest";
import * as helpers from "../window-helpers";
import { listenForBooks, listenForExtension } from "../listeners";

function mockAddEventListenerExtension(eventName: string, cb: (event: MessageEvent) => void) {
	if (eventName === "message") {
		const message = new MessageEvent("message", {
			source: window,
			data: {
				message: "BOOK_FETCHER:PING_RES"
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
				message: "BOOK_FETCHER:RES",
				books: [{ title: "book-123456" }]
			}
		});

		cb(message);
	}
}
function mockAddEventListenerBooksTimeout(eventName: string, cb: (event: MessageEvent) => void) {
	if (eventName === "message") {
		const message = new MessageEvent("message", {
			source: window,
			data: {
				message: "BOOK_FETCHER:RES",
				books: [{ title: "book-123456" }]
			}
		});

		setTimeout(() => cb(message), 300);
	}
}

describe("book fetching listeners", () => {
	test("listenForExtension resolves to true when it receives response to ping", async () => {
		vi.spyOn(helpers, "addEventListener").mockImplementation(mockAddEventListenerExtension);

		helpers.postMessage(`BOOK_FETCHER:PING_REQ`);

		const extensionAvailable = await listenForExtension("BOOK_FETCHER:PING_RES", 1000);

		expect(extensionAvailable).toEqual(true);
	});

	test("listenForBooks resolves to books when it receives response from extension", async () => {
		vi.spyOn(helpers, "addEventListener").mockImplementation(mockAddEventListenerBooks);

		helpers.postMessage(`BOOK_FETCHER:REQ`);

		const books = await listenForBooks("BOOK_FETCHER:RES", 1000);

		expect(books).toEqual([{ title: "book-123456" }]);
	});

	test("listenForBooks resolves to [] when book data is not received before timeout", async () => {
		vi.spyOn(helpers, "addEventListener").mockImplementation(mockAddEventListenerBooksTimeout);

		helpers.postMessage(`BOOK_FETCHER:REQ`);

		const books = await listenForBooks("BOOK_FETCHER:RES", 200);

		expect(books).toEqual([]);
	});
});
