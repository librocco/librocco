import { BookFetcherPlugin as BookFetcherPluginType, BookEntry } from "@librocco/db";
import { postMessage } from "./window-helpers";
import { listenForBooks, listenForExtension } from "./listeners";

export const BookFetcherPlugin = (): BookFetcherPluginType => {
	const fetchBookData = async (isbns: string[]): Promise<BookEntry[]> => {
		// Check if the extension is registered if not resolve to []
		postMessage(`BOOK_FETCHER:PING_REQ`);

		const extensionAvailable = await listenForExtension(`BOOK_FETCHER:PING_RES`, 800);

		if (!extensionAvailable) return new Promise((resolve) => resolve([]));

		// Post message to the extension
		postMessage(`BOOK_FETCHER:REQ:${isbns}`);

		// Listen for a response and resolve to [] after timeout
		return listenForBooks(`BOOK_FETCHER:RES`, 800);
	};

	return { fetchBookData };
};
