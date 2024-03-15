import { test, describe, expect, vi } from "vitest";
import * as listeners from "../listeners";
import * as helpers from "../window-helpers";
import { createBookDataExtensionPlugin } from "..";

function mockListenForExtension() {
	return new Promise<boolean>((resolve) => resolve(true));
}

function mockAddEventListenerBooks(book: Record<string, string> | undefined, timeout = 0) {
	return function (eventName: string, cb: (event: MessageEvent) => void) {
		if (eventName === "message") {
			const isbn = book?.title.split("-")[1];
			const message = new MessageEvent("message", {
				source: window,
				data: {
					message: `BOOK_FETCHER:RES:${isbn}`,
					book
				}
			});

			setTimeout(() => cb(message), timeout);
		}
	};
}

describe("createBookDataExtensionPlugin", () => {
	test("fetchBookData returns books when called with isbns", async () => {
		vi.spyOn(listeners, "listenForExtension").mockImplementation(mockListenForExtension);
		vi.spyOn(helpers, "addEventListener").mockImplementation(mockAddEventListenerBooks({ title: "book-12345" }));

		const books = await createBookDataExtensionPlugin().fetchBookData(["12345"]);

		expect(books).toEqual([{ title: "book-12345" }]);
	});

	test("fetchBookData returns [] when called with isbn that are not found", async () => {
		vi.spyOn(listeners, "listenForExtension").mockImplementation(mockListenForExtension);
		vi.spyOn(helpers, "addEventListener").mockImplementation(mockAddEventListenerBooks(undefined));

		const books = await createBookDataExtensionPlugin().fetchBookData(["12345"]);

		expect(books).toEqual([]);
	});

	test("fetchBookData returns [] when book data is not received before timeout", async () => {
		vi.spyOn(listeners, "listenForExtension").mockImplementation(mockListenForExtension);
		vi.spyOn(helpers, "addEventListener").mockImplementation(mockAddEventListenerBooks({ title: "book-12345" }, 5000));

		const books = await createBookDataExtensionPlugin().fetchBookData(["12345"]);

		expect(books).toEqual([]);
	});

	test("fetchBookData returns [] when plugin is not installed", async () => {
		vi.spyOn(listeners, "listenForExtension").mockImplementation(vi.fn(() => new Promise<boolean>((resolve) => resolve(false))));
		vi.spyOn(helpers, "addEventListener").mockImplementation(mockAddEventListenerBooks({ title: "book-12345" }));

		const books = await createBookDataExtensionPlugin().fetchBookData(["12345"]);

		expect(books).toEqual([]);
	});

	test("fetchBookData when called with isbns some of which are not found, returns array with only found books", async () => {
		vi.spyOn(listeners, "listenForExtension").mockImplementation(mockListenForExtension);
		vi.spyOn(helpers, "addEventListener")
			.mockImplementationOnce(mockAddEventListenerBooks({ title: "book-12345" }))
			.mockImplementationOnce(mockAddEventListenerBooks({ title: "book-56789" }))
			.mockImplementationOnce(mockAddEventListenerBooks(undefined));

		const books = await createBookDataExtensionPlugin().fetchBookData(["12345", "56789"]);

		expect(books).toEqual([{ title: "book-12345" }, { title: "book-56789" }]);
	});

	test("fetchBookData when called with isbns some of which timeout, returns array with only returned books", async () => {
		vi.spyOn(listeners, "listenForExtension").mockImplementation(mockListenForExtension);
		vi.spyOn(helpers, "addEventListener")
			.mockImplementationOnce(mockAddEventListenerBooks({ title: "book-56789" }))
			.mockImplementationOnce(mockAddEventListenerBooks({ title: "book-12345" }))
			.mockImplementationOnce(mockAddEventListenerBooks({ title: "book-49857" }, 4000));

		const books = await createBookDataExtensionPlugin().fetchBookData(["56789", "12345", "49857"]);

		expect(books).toEqual([{ title: "book-56789" }, { title: "book-12345" }]);
	});
});
