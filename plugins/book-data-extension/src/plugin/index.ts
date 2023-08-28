import { BookFetcherPlugin as BookFetcherPluginType, BookEntry } from "@librocco/db";
import { postMessage, addEventListener, removeEventListener } from "./window-helpers";
import { listenForBooks } from "./listeners";

export const BookFetcherPlugin = (): BookFetcherPluginType => {
	const fetchBookData = async (isbns: string[]): Promise<BookEntry[]> => {
		// Check if the extension is registered if not resolve to []

		postMessage(`BOOK_FETCHER_REQ:checkForExtension:${isbns}`);

		const extensionAvailable = await new Promise((resolve) => {
			let resolved = false;

			const promiseHandler = () => {
				window.removeEventListener("message", handler);

				if (!resolved) {
					clearTimeout(promiseTimer);
					resolve(false);
				}
			};
			const promiseTimer = setTimeout(promiseHandler, 1000);

			const handler = (event: MessageEvent) => {
				if (event.source !== window) return;
				if (event.data.message && event.data.message === `BOOK_FETCHER_REQ:replyFromExtension:`) {
					resolved = true;
					clearTimeout(promiseTimer);

					removeEventListener("message", handler);
					resolve(true);
				}
			};
			addEventListener("message", handler);
		});

		if (!extensionAvailable) return new Promise((resolve) => resolve([]));

		// Post message to the extension
		/** @TODO add batch id to serial instead of isbn */
		postMessage(`BOOK_FETCHER_REQ:bookFetcherPlugin:`);

		// Listen for a response and resolve to null after timeout

		return listenForBooks(`BOOK_FETCHER_RES:bookFetcherPlugin:`, 800);
	};

	return { fetchBookData };
};
