import { BehaviorSubject } from "rxjs";

import { type BookFetcherPlugin, type BookEntry } from "@librocco/db";

const baseurl = "https://www.googleapis.com/books/v1/volumes";
const reqFields = ["volumeInfo/title", "volumeInfo/authors", "volumeInfo/publisher", "volumeInfo/publishedDate"].join(",");

export function createGoogleBooksApiPlugin(): BookFetcherPlugin {
	// The plugin is always available (as long as there's internet connection)
	const isAvailableStream = new BehaviorSubject(true);

	const fetchBookData = async (isbns: string[]): Promise<(Partial<BookEntry> | undefined)[]> => {
		return Promise.all(isbns.map((isbn) => fetchBook(isbn).then(processResponse)));
	};

	return { fetchBookData, isAvailableStream };
}

type GBookEntry = {
	volumeInfo: {
		isbn: string;
		title?: string;
		authors?: string[];
		publisher?: string;
		publishedDate?: string;
	};
};

type GBooksRes = {
	items?: GBookEntry[];
};

async function fetchBook(isbn: string): Promise<GBookEntry | undefined> {
	const url = new URL(baseurl);

	url.searchParams.append("q", `isbn:${isbn}`);
	url.searchParams.append("maxResults", "1");
	url.searchParams.append("fields", `items(${reqFields})`);

	const { items = [] } = await fetch(url).then((r) => r.json() as GBooksRes);
	const [gBookData] = items;
	gBookData.volumeInfo = { ...gBookData.volumeInfo, isbn };

	return gBookData;
}

function processResponse(gBook: GBookEntry | undefined): Partial<BookEntry> | undefined {
	if (!gBook) {
		return undefined;
	}

	const res: Partial<BookEntry> = {};

	const { title, authors: _authors, publisher, publishedDate, isbn } = gBook.volumeInfo;
	const authors = _authors?.join(", ");
	const year = publishedDate?.slice(0, 4);

	if (title) res.title = title;
	if (authors) res.authors = authors;
	if (publisher) res.publisher = publisher;
	if (year) res.year = year;
	res.isbn = isbn;

	return res;
}
