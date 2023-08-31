import { test, describe, expect, vi } from "vitest";
import * as listeners from "../listeners";
import * as helpers from "../window-helpers";
import { BookFetcherPlugin } from "..";

function mockListenForExtension() {
    return new Promise<boolean>((resolve) => resolve(true));
}

function mockAddEventListenerBooks(eventName: string, cb: (event: MessageEvent) => void) {
    if (eventName === "message") {
        const message = new MessageEvent("message", {
            source: window,
            data: {
                message: "BOOK_FETCHER:RES",
                books: [{ title: "book-12345" }]
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

        setTimeout(() => cb(message), 900);
    }
}

describe("book fetcher plugin", () => {
    test("fetchBookData returns books when called with isbns", async () => {
        vi.spyOn(listeners, "listenForExtension").mockImplementation(mockListenForExtension);
        vi.spyOn(helpers, "addEventListener").mockImplementation(mockAddEventListenerBooks);

        const books = await BookFetcherPlugin().fetchBookData(["12345"]);

        expect(books).toEqual([{ title: "book-12345" }]);
    });

    test("fetchBookData returns [] when book data is not received before timeout", async () => {
        vi.spyOn(listeners, "listenForExtension").mockImplementation(mockListenForExtension);
        vi.spyOn(helpers, "addEventListener").mockImplementation(mockAddEventListenerBooksTimeout);

        const books = await BookFetcherPlugin().fetchBookData(["12345"]);

        expect(books).toEqual([]);
    });

    test("fetchBookData returns [] when plugin is not installed", async () => {
        vi.spyOn(listeners, "listenForExtension").mockImplementation(vi.fn(() => new Promise<boolean>((resolve) => resolve(false))));
        vi.spyOn(helpers, "addEventListener").mockImplementation(mockAddEventListenerBooks);

        const books = await BookFetcherPlugin().fetchBookData(["12345"]);

        expect(books).toEqual([]);
    });
});
