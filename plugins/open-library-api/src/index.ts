import { BehaviorSubject } from "rxjs";

import { type BookFetcherPlugin, type BookData, fetchBookDataFromSingleSource } from "@librocco/shared";

const baseurl = (url: string) => `https://openlibrary.org/isbn/${url}.json`;

export function createOpenLibraryApiPlugin(): BookFetcherPlugin {
	// The plugin is always available (as long as there's internet connection)
	const isAvailableStream = new BehaviorSubject(true);

	const fetchBookData = fetchBookDataFromSingleSource((isbn) => fetchBook(isbn).then(processResponse(isbn)));

	return { __name: "open-library-api", fetchBookData, isAvailableStream };
}

type OLBookEntry = {
	title?: string;
	author?: string[];
	publishers?: string[];
	publish_date?: string[];
};
type BookEntryWithAuthors = OLBookEntry & { authors?: { key: string }[] };
async function fetchBook(isbn: string): Promise<OLBookEntry> {
	const url = new URL(baseurl(isbn));

	const res = await fetch(url, { redirect: "follow" }).then((r) => r.json() as BookEntryWithAuthors);
	let author_res;
	const author = [];

	if (res.authors?.length) {
		for (const { key } of res.authors) {
			console.log(key);
			author_res = await fetch(`https://openlibrary.org${key}.json`).then((r) => r.json());
			author.push(author_res.name);
		}

		res.author = author;
	}
	return res;
}

function processResponse(isbn: string) {
	return (olBook: OLBookEntry | undefined): BookData | undefined => {
		if (!olBook) {
			return undefined;
		}

		const res: BookData = { isbn };

		const { title, author, publishers, publish_date } = olBook;
		const joined_authors = author?.join(", ");
		const joined_publishers = publishers?.join(", "); // join or first element?
		const year = publish_date?.[0] || "";

		if (title) res.title = title;
		if (author) res.authors = joined_authors;
		if (joined_publishers) res.publisher = joined_publishers;
		if (year) res.year = year;

		return res;
	};
}
