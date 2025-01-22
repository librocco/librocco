import type { BookData } from "@librocco/shared";

import { postMessage } from "./window-helpers";
import { listenWithTimeout } from "./listeners";

export async function ping() {
	// Post message for the extension
	postMessage(`BOOK_FETCHER:PING`);
	const res = await listenWithTimeout(`BOOK_FETCHER:PONG`, 500);
	return res.ok;
}

export async function fetchBook(isbn: string): Promise<BookData | undefined> {
	// Post message for the extension
	postMessage(`BOOK_FETCHER:REQ:${isbn}`);
	const res = await listenWithTimeout<{ book: BookData }, BookData>(`BOOK_FETCHER:RES:${isbn}`, ({ book }) => book, 4000);
	// 'res.data' could also be undefined here, meaning: the extension responded, but no data was found (this aligns with the expected behaviour)
	return res.ok ? res.data : undefined;
}
