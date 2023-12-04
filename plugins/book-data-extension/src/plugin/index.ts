import { BookFetcherPlugin, BookEntry } from "@librocco/db";
import { postMessage } from "./window-helpers";
import { listenForBook, listenForExtension } from "./listeners";

export const createBookDataExtensionPlugin = (): BookFetcherPlugin => {
	const fetchBookData = async (isbns: string[]): Promise<BookEntry[]> => {
		// Check if the extension is registered if not resolve to []
		postMessage(`BOOK_FETCHER:PING`);

		const extensionAvailable = await listenForExtension(`BOOK_FETCHER:PONG`, 500);

		if (!extensionAvailable) return [];

		const unfilteredBookData = await Promise.all(isbns.map((isbn) => fetchBook(isbn)));

		return unfilteredBookData.filter((bookData): bookData is BookEntry => bookData !== undefined
			&& bookData.isbn !== undefined
			&& bookData.title !== undefined
			&& bookData.price !== undefined);
	};

	const fetchBook = (isbn: string) => {
		// Post message to the extension
		postMessage(`BOOK_FETCHER:REQ:${isbn}`);

		return listenForBook(`BOOK_FETCHER:RES:${isbn}`, 4000);
	};

	return { fetchBookData };
};
