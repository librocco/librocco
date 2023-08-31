import { BookFetcherPlugin as BookFetcherPluginType, BookEntry } from "@librocco/db";
import { postMessage } from "./window-helpers";
import { listenForBook, listenForExtension } from "./listeners";

export const BookFetcherPlugin = (): BookFetcherPluginType => {
	const fetchBookData = async (isbns: string[]): Promise<BookEntry[]> => {
		// Check if the extension is registered if not resolve to []
		postMessage(`BOOK_FETCHER:PING`);

		const extensionAvailable = await listenForExtension(`BOOK_FETCHER:PONG`, 500);

		if (!extensionAvailable) return new Promise((resolve) => resolve([]));

		const unfilteredBookData = await Promise.all(isbns.map((isbn) => fetchBook(isbn)));

		return unfilteredBookData.filter((bookData): bookData is BookEntry => bookData !== undefined);
	};

	const fetchBook = (isbn: string) => {
		// Post message to the extension
		postMessage(`BOOK_FETCHER:REQ:${isbn}`);

		// Listen for a response and resolve to [] after timeout
		return listenForBook(`BOOK_FETCHER:RES`, 800);
	};

	return { fetchBookData };
};
