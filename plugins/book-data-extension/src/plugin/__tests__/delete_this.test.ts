import { test, expect } from "vitest";

import { BookEntry, BookFetcherPlugin } from "@librocco/db";

test("delete this file - this test is here to make sure we can run tests with 'window' object being defined", async () => {
	window.addEventListener("message", (e) => {
		console.log("[MOCK] Received message", JSON.stringify(e));
		if (e.data.message === "fetch-books") {
			const { isbn } = e.data;
			window.postMessage({ message: "fetch-books-res", title: `Title-${isbn}` }, "*");
		}
	});

	const plugin: BookFetcherPlugin = {
		fetchBookData: async (isbns: string[]) => {
			window.postMessage({ message: "fetch-books", isbn: isbns[0] }, "*");
			return new Promise<BookEntry[]>((resolve) =>
				window.addEventListener("message", (e) => {
					console.log("[PLUGIN] Received message", e);
					if (e.data.message === "fetch-books-res") {
						resolve([{ title: e.data.title } as any]);
					}
				})
			);
		}
	};

	const res = await plugin.fetchBookData(["123"]);

	expect(res).toEqual([{ title: "Title-123" }]);
});
