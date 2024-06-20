import { BehaviorSubject, Observable, from } from "rxjs";

import type { BookFetchResult, BookFetchResultEntry, BookFetcherPlugin } from "@/types";

export const fetchBookDataFromSingleSource =
	(constructRequest: (isbn: string) => Promise<BookFetchResultEntry>) =>
	(isbn: string): BookFetchResult => {
		const request = constructRequest(isbn);
		const first = () => request;
		const stream = () => from(request);
		const all = () => Promise.all([request]);
		return { first, stream, all };
	};

export const createSingleSourceBookFetcher = (
	name: string,
	constructRequest: (isbn: string) => Promise<BookFetchResultEntry>,
	availabilityStream: Observable<boolean> | boolean
): BookFetcherPlugin => ({
	__name: name,
	fetchBookData: fetchBookDataFromSingleSource(constructRequest),
	isAvailableStream: typeof availabilityStream === "boolean" ? new BehaviorSubject(availabilityStream) : availabilityStream
});
