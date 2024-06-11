import { from } from "rxjs";

import type { BookFetchResult, BookFetchResultEntry } from "@/types";

export const fetchBookDataFromSingleSource =
	(constructRequest: (isbns: string[]) => Promise<BookFetchResultEntry[]>) =>
	(isbns: string[]): BookFetchResult => {
		const request = constructRequest(isbns);
		const first = () => request;
		const stream = () => from(request);
		const all = () => Promise.all([request]);
		return { first, stream, all };
	};
