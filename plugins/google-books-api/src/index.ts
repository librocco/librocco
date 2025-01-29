import { BehaviorSubject } from "rxjs";

import { type BookFetcherPlugin, BookData, fetchBookDataFromSingleSource } from "@librocco/shared";

const baseurl = "https://www.googleapis.com/books/v1/volumes";
const reqFields = [
	"volumeInfo/title",
	"volumeInfo/authors",
	"volumeInfo/publisher",
	"volumeInfo/publishedDate",
	"volumeInfo/categories"
].join(",");

export function createGoogleBooksApiPlugin(): BookFetcherPlugin {
	// The plugin is always available (as long as there's internet connection)
	const isAvailableStream = new BehaviorSubject(true);

	const fetchBookData = fetchBookDataFromSingleSource((isbn) => fetchBook(isbn).then(processResponse(isbn)));

	return { __name: "google-books-api", fetchBookData, isAvailableStream };
}

type GBookEntry = {
	volumeInfo: {
		title?: string;
		authors?: string[];
		publisher?: string;
		publishedDate?: string;
		categories?: string[];
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

	return gBookData;
}

function processResponse(isbn: string) {
	return (gBook: GBookEntry | undefined): BookData | undefined => {
		if (!gBook) {
			return undefined;
		}

		const res: BookData = { isbn };

		// TODO: We're picking the first category, whereas google books can return multiple categories, find a way to handle this
		const { title, authors: _authors, publisher, publishedDate, categories: [category] = [] } = gBook.volumeInfo;
		const authors = _authors?.join(", ");
		const year = publishedDate?.slice(0, 4);

		if (title) res.title = title;
		if (authors) res.authors = authors;
		if (publisher) res.publisher = publisher;
		if (year) res.year = year;
		if (category) res.category = category;

		return res;
	};
}
