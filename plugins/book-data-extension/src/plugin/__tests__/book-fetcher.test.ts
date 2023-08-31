import { test, describe, expect, vi } from "vitest";
import * as listeners from "../listeners";
import * as helpers from "../window-helpers";
import { BookFetcherPlugin } from "..";

function mockListenForExtension() {
	return new Promise<boolean>((resolve) => resolve(true));
}

function mockAddEventListenerBooks(book: Record<string, string> | undefined, timeout = 0) {
	return function (eventName: string, cb: (event: MessageEvent) => void) {
		if (eventName === "message") {
			const message = new MessageEvent("message", {
				source: window,
				data: {
					message: "BOOK_FETCHER:RES",
					book
				}
			});

			setTimeout(() => cb(message), timeout);
		}
	};
}

describe("BookFetcherPlugin", () => {
	test("fetchBookData returns books when called with isbns", async () => {
		vi.spyOn(listeners, "listenForExtension").mockImplementation(mockListenForExtension);
		vi.spyOn(helpers, "addEventListener").mockImplementation(mockAddEventListenerBooks({ title: "book-12345" }));

		const books = await BookFetcherPlugin().fetchBookData(["12345"]);

		expect(books).toEqual([{ title: "book-12345" }]);
	});

	test("fetchBookData returns [] when called with isbn that are not found", async () => {
		vi.spyOn(listeners, "listenForExtension").mockImplementation(mockListenForExtension);
		vi.spyOn(helpers, "addEventListener").mockImplementation(mockAddEventListenerBooks(undefined));

		const books = await BookFetcherPlugin().fetchBookData(["12345"]);

		expect(books).toEqual([]);
	});

	test("fetchBookData returns [] when book data is not received before timeout", async () => {
		vi.spyOn(listeners, "listenForExtension").mockImplementation(mockListenForExtension);
		vi.spyOn(helpers, "addEventListener").mockImplementation(mockAddEventListenerBooks({ title: "book-12345" }, 900));

		const books = await BookFetcherPlugin().fetchBookData(["12345"]);

		expect(books).toEqual([]);
	});

	test("fetchBookData returns [] when plugin is not installed", async () => {
		vi.spyOn(listeners, "listenForExtension").mockImplementation(vi.fn(() => new Promise<boolean>((resolve) => resolve(false))));
		vi.spyOn(helpers, "addEventListener").mockImplementation(mockAddEventListenerBooks({ title: "book-12345" }));

		const books = await BookFetcherPlugin().fetchBookData(["12345"]);

		expect(books).toEqual([]);
	});
});
