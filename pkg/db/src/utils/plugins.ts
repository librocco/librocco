import { from } from "rxjs";

import type { BookFetchResult, BookFetchResultEntry } from "@/types";

export const fetchBookDataFromSingleSource =
	(constructRequest: (isbns: string[]) => Promise<BookFetchResultEntry[]>) =>
	(isbns: string[]): BookFetchResult => {
		const request = constructRequest(isbns);
		const promise = () => Promise.all([request]);
		const stream = () => from(request);
		const onResult = (cb: (r: BookFetchResultEntry[]) => void) => stream().subscribe(cb);
		return { promise, stream, onResult };
	};
