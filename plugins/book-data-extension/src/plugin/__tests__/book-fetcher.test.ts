import { filter, firstValueFrom } from "rxjs";
import { test, expect, vi } from "vitest";

import type { BookData, BookFetcherPlugin } from "@librocco/shared";
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

test("fetchBookData returns book when called with isbn", async () => {
	vi.spyOn(comm, "ping").mockImplementation(() => Promise.resolve(true));
	vi.spyOn(comm, "fetchBook").mockImplementation((isbn: string) => Promise.resolve({ title: `book-${isbn}` } as BookData));

	const plugin = await withExtensionAvailable(createBookDataExtensionPlugin());

	expect(await plugin.fetchBookData("3333").first()).toEqual({ title: "book-3333" });
});
