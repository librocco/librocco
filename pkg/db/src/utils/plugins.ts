import { from } from "rxjs";

import type { BookFetchResult, BookFetchResultEntry } from "@/types";

export const fetchBookDataFromSingleSource =
	(constructRequest: (isbn: string) => Promise<BookFetchResultEntry>) =>
	(isbn: string): BookFetchResult => {
		const request = constructRequest(isbn);
		const first = () => request;
		const stream = () => from(request);
		const all = () => Promise.all([request]);
		return { first, stream, all };
	};
