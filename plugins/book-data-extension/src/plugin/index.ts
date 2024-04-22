import { BehaviorSubject, Observable, concat, from, share } from "rxjs";

import { BookFetcherPlugin, BookEntry } from "@librocco/db";

import { continuousListener } from "./listeners";
import { fetchBook, ping } from "./comm";

export const createBookDataExtensionPlugin = (): BookFetcherPlugin => {
	// Continuous availability stream
	const isAvailableStream = createAvailabilityStream();

	const fetchBookData = async (isbns: string[]): Promise<(BookEntry | undefined)[]> => {
		return Promise.all(isbns.map((isbn) => fetchBook(isbn)));
	};

	return { fetchBookData, isAvailableStream };
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
	return concat(from(ping()), listener).pipe(
		share({ connector: () => shareSuject, resetOnComplete: false, resetOnError: false, resetOnRefCountZero: false })
	);
};
