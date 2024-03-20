import { BehaviorSubject } from "rxjs";
import { BookFetcherPlugin, BookEntry } from "@librocco/db";
import { postMessage } from "./window-helpers";
import { listenForBook, listenForExtension } from "./listeners";

export const createBookDataExtensionPlugin = (): BookFetcherPlugin => {
	const AvailabilitySubject = new BehaviorSubject<boolean>(false);

	const fetchBookData = async (isbns: string[]): Promise<BookEntry[]> => {
		// Check if the extension is registered if not resolve to []
		postMessage(`BOOK_FETCHER:PING`);

		const extensionAvailable = await listenForExtension(`BOOK_FETCHER:PONG`, 500);

		if (!extensionAvailable) {
			AvailabilitySubject.next(false);

			return [];
		}

		AvailabilitySubject.next(true);

		const unfilteredBookData = await Promise.all(isbns.map((isbn) => fetchBook(isbn)));

		return unfilteredBookData.filter(
			(bookData): bookData is BookEntry => bookData !== undefined && bookData.isbn !== "" && bookData.title !== ""
		);
	};
	const checkAvailability = async (): Promise<void> => {
		// Check if the extension is registered
		postMessage(`BOOK_FETCHER:PING`);

		const extensionAvailable = await listenForExtension(`BOOK_FETCHER:PONG`, 500);

		if (!extensionAvailable) {
			AvailabilitySubject.next(false);
			return;
		}
		AvailabilitySubject.next(true);
	};

	const fetchBook = (isbn: string) => {
		// Post message to the extension
		postMessage(`BOOK_FETCHER:REQ:${isbn}`);

		return listenForBook(`BOOK_FETCHER:RES:${isbn}`, 4000);
	};

	return { fetchBookData, checkAvailability, AvailabilitySubject };
};
