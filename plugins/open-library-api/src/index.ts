import { BehaviorSubject } from "rxjs";

import { type BookFetcherPlugin, type BookEntry, fetchBookDataFromSingleSource } from "@librocco/db";

const baseurl = "https://openlibrary.org/search.json";
// publisher is an array
// author is an array
// publish date is an array
const reqFields = ["title", "author_name", "publisher", "publish_date"].join(",");

export function createOpenLibraryApiPlugin(): BookFetcherPlugin {
	// The plugin is always available (as long as there's internet connection)
	const isAvailableStream = new BehaviorSubject(true);

	const fetchBookData = fetchBookDataFromSingleSource((isbn) => fetchBook(isbn).then(processResponse(isbn)));

	return { __name: "open-library-api", fetchBookData, isAvailableStream };
}

type OLBookEntry = {
	title?: string;
	author_name?: string[];
	publisher?: string[];
	publish_date?: string[];
};

type OLBooksRes = {
	docs?: OLBookEntry[];
};

async function fetchBook(isbn: string): Promise<OLBookEntry> {
	const url = new URL(baseurl);

	url.searchParams.append("q", isbn);
	url.searchParams.append("limit", "1");
	url.searchParams.append("fields", reqFields);

	const { docs = [] } = await fetch(url).then((r) => r.json() as OLBooksRes);
	const [olBookData] = docs;

	return olBookData;
}

function processResponse(isbn: string) {
	return (olBook: OLBookEntry | undefined): Partial<BookEntry> | undefined => {
		if (!olBook) {
			return undefined;
		}

		const res: Partial<BookEntry> = {};

		const { title, author_name: _authors, publisher, publish_date } = olBook;
		const authors = _authors?.join(", ");
		const publishers = publisher?.join(", "); // join or first element?
		const year = publish_date?.[0] || "";

		if (title) res.title = title;
		if (authors) res.authors = authors;
		if (publishers) res.publisher = publishers;
		if (year) res.year = year;

		return { ...res, isbn };
	};
}
