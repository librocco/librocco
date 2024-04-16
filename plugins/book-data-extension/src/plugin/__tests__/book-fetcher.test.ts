import { filter, firstValueFrom } from "rxjs";
import { test, describe, expect, vi } from "vitest";

import { BookEntry, BookFetcherPlugin } from "@librocco/db";
import { testUtils } from "@librocco/shared";

import * as comm from "../comm";
import { createBookDataExtensionPlugin } from "..";

const { waitFor } = testUtils;
/** A convenience method to wait for the extension to become "available" */
const waitForAvailable = (plugin: BookFetcherPlugin) =>
	waitFor(async () => {
		await firstValueFrom(plugin.isAvailableStream.pipe(filter(Boolean)));
	});
const withExtensionAvailable = async (plugin: BookFetcherPlugin) => {
	await waitForAvailable(plugin);
	return plugin;
};

describe("createBookDataExtensionPlugin", () => {
	test("fetchBookData returns books when called with isbns", async () => {
		vi.spyOn(comm, "ping").mockImplementation(() => Promise.resolve(true));
		vi.spyOn(comm, "fetchBook").mockImplementation((isbn: string) => Promise.resolve({ title: `book-${isbn}` } as BookEntry));

		const plugin = await withExtensionAvailable(createBookDataExtensionPlugin());
		// The isbns are in a scattered lexicographical order to verify that the results will come in the same order as requested
		const books = await plugin.fetchBookData(["3333", "1111", "2222"]);

		expect(books).toEqual([{ title: "book-3333" }, { title: "book-1111" }, { title: "book-2222" }]);
	});

	test("fetchBookData returns the same number of results even if book data for some isbns isn't found", async () => {
		vi.spyOn(comm, "ping").mockImplementation(() => Promise.resolve(true));
		vi.spyOn(comm, "fetchBook").mockImplementation((isbn: string) =>
			isbn == "1111"
				? // Make it so as if "1111" is not found
				  Promise.resolve(undefined)
				: Promise.resolve({ title: `book-${isbn}` } as BookEntry)
		);

		const plugin = await withExtensionAvailable(createBookDataExtensionPlugin());
		const books = await plugin.fetchBookData(["3333", "1111", "2222"]);

		expect(books).toEqual([{ title: "book-3333" }, undefined, { title: "book-2222" }]);
	});

	test("fetchBookData returns array filled with undefined values if extension is not available", async () => {
		vi.spyOn(comm, "ping").mockImplementation(() => Promise.resolve(false));
		vi.spyOn(comm, "fetchBook").mockImplementation((isbn: string) =>
			isbn == "1111"
				? // Make it so as if "1111" is not found
				  Promise.resolve(undefined)
				: Promise.resolve({ title: `book-${isbn}` } as BookEntry)
		);

		const plugin = createBookDataExtensionPlugin();
		const books = await plugin.fetchBookData(["3333", "1111", "2222"]);

		expect(books).toEqual([undefined, undefined, undefined]);
	});
});
