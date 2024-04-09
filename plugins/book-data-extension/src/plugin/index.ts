import { BehaviorSubject, Observable, concat, firstValueFrom, from, share } from "rxjs";
import { BookFetcherPlugin, BookEntry } from "@librocco/db";
import { postMessage } from "./window-helpers";
import { continuousListener, listenForBook, listenForExtension } from "./listeners";

export const createBookDataExtensionPlugin = (): BookFetcherPlugin => {
	// Continuous availability stream
	const isAvailableStream = createAvailabilityStream();
	// Imperative (promisified) check for the availability
	const isAvailable = () => firstValueFrom(isAvailableStream);

	const fetchBookData = async (isbns: string[]): Promise<BookEntry[]> => {
		if (!(await isAvailable())) {
			return [];
		}

		const unfilteredBookData = await Promise.all(isbns.map((isbn) => fetchBook(isbn)));

		return unfilteredBookData.filter(
			(bookData): bookData is BookEntry => bookData !== undefined && bookData.isbn !== "" && bookData.title !== ""
		);
	};

	const fetchBook = (isbn: string) => {
		postMessage(`BOOK_FETCHER:REQ:${isbn}`);
		return listenForBook(`BOOK_FETCHER:RES:${isbn}`, 4000);
	};

	return { fetchBookData, isAvailableStream };
};

const checkAvailability = async () => {
	// Check if the extension is registered
	postMessage(`BOOK_FETCHER:PING`);
	return listenForExtension(`BOOK_FETCHER:PONG`, 500);
};

const createAvailabilityStream = () => {
	// Message received when the extension is registered
	const message = "BOOK_FETCHER:ACTIVE";
	const shareSuject = new BehaviorSubject(false);
	// A new observable is created, listening to register events from the extension
	// The 'continuousListener' registers a listener to the event and returns the cleanup function (removing the listener) the same value is passed
	// to the observable initialisation, propagating the cleanup behaviour to when the observable goes out of scope (get's garbage collected, to be more precise)
	const listener = new Observable<boolean>((observer) =>
		continuousListener(message, ({ isAvailable }: { isAvailable: boolean }) => {
			observer.next(isAvailable);
		})
	);
	// The first value is the imperative check, with the listener continuing the stream
	return concat(from(checkAvailability()), listener).pipe(share({ connector: () => shareSuject }));
};
