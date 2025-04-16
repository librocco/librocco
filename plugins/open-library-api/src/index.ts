import { BehaviorSubject } from "rxjs";

import { type BookFetcherPlugin, type BookData, fetchBookDataFromSingleSource } from "@librocco/shared";

const isbnToOLUrl = (isbn: string) => `https://openlibrary.org/isbn/${isbn}.json`;

export function createOpenLibraryApiPlugin(): BookFetcherPlugin {
	// The plugin is always available (as long as there's internet connection)
	const isAvailableStream = new BehaviorSubject(true);

	const fetchBookData = fetchBookDataFromSingleSource((isbn) => fetchBook(isbn).then(processResponse(isbn)));

	return { __name: "open-library-api", fetchBookData, isAvailableStream };
}

type OLBookEntry = {
	title?: string;
	author?: string;
	publishers?: string[];
	publish_date?: string[];
};

type OpenLibraryRawBookResponse = {
	title?: string;
	publishers?: string[];
	publish_date?: string[];
	authors?: { key: string }[];
};

type OpenLibraryRawAuthorResponse = {
	name?: string;
};

async function fetchBook(isbn: string): Promise<OLBookEntry> {
	const url = new URL(isbnToOLUrl(isbn));

	const httpResponse = await fetch(url, { redirect: "follow" });

	const rawBookData = (await httpResponse.json()) as OpenLibraryRawBookResponse;

	const bookEntry: OLBookEntry = {};

	let author_requests: Promise<Response>[] = [];

	if (rawBookData.authors?.length) {
		author_requests = rawBookData.authors.map(({ key }) => fetch(`https://openlibrary.org${key}.json`));
	}

	const author_responses = await Promise.all(author_requests);
	const authors_parsed = (await Promise.all(
		author_responses.map((author_response) => author_response.json())
	)) as OpenLibraryRawAuthorResponse[];
	const author_names = authors_parsed.map((author) => author.name).join(", ");

	bookEntry.author = author_names;
	bookEntry.publish_date = rawBookData.publish_date;
	bookEntry.title = rawBookData.title;
	bookEntry.publishers = rawBookData.publishers;

	return bookEntry;
}

function processResponse(isbn: string) {
	return (olBook: OLBookEntry | undefined): BookData | undefined => {
		if (!olBook) {
			return undefined;
		}

		const res: BookData = { isbn };

		const { title, author, publishers, publish_date } = olBook;
		// const joined_authors = author?.join(", ");
		const joined_publishers = publishers?.join(", "); // join or first element?
		const year = publish_date?.[0] || "";

		if (title) res.title = title;
		if (author) res.authors = author;
		if (joined_publishers) res.publisher = joined_publishers;
		if (year) res.year = year;

		return res;
	};
}
