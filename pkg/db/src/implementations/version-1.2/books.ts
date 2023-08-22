import { concat, from, Observable, switchMap, tap } from "rxjs";

import { debug, wrapIter, PluginManager } from "@librocco/shared";

import { BookEntry, BooksInterface, DatabaseInterface } from "@/types";

import { newChangesStream, unwrapDocs } from "@/utils/pouchdb";

class Books implements BooksInterface {
	#db: DatabaseInterface;
	#pluginManagerInstance: PluginManager;

	constructor(db: DatabaseInterface, pluginManagerInstance?: PluginManager) {
		this.#db = db;
		this.#pluginManagerInstance = pluginManagerInstance || new PluginManager();
	}

	async upsert(bookEntries: BookEntry[]): Promise<void> {
		const bookIds = bookEntries.map((b) => `books/${b.isbn}`);

		const docs = await this.#db._pouch.allDocs({ keys: bookIds, include_docs: true }).then(({ rows }) => {
			// rows => contain _id and _rev
			// Merge result with bookEntries
			const mergedArray = bookEntries.map((b) => {
				// Find the corresponding doc in result
				const match = rows.find((row) => row.id === `books/${b.isbn}`);
				// If a match is found, return the merged object
				if (match && match.doc) {
					return {
						...match.doc,
						_rev: match.value.rev,
						...b
					};
				}
				// If no match is found, return the original book with _id added

				return {
					...b,
					_id: `books/${b.isbn}`
				};
			});
			return mergedArray;
		});
		return new Promise<void>((resolve) => this.#db._pouch.bulkDocs(docs).then(() => resolve()));
	}

	async get(isbns: string[]): Promise<(BookEntry | undefined)[]> {
		const books = await this.#db._pouch
			.allDocs<BookEntry>({ keys: isbns.map((isbn) => `books/${isbn}`), include_docs: true })
			// The rows are returned in the same order as the supplied keys array.
			// The row for a nonexistent document will just contain an "error" property with the value "not_found".
			.then((docs) => unwrapDocs(docs));

		const isbnsToFetch = wrapIter(isbns)
			.zip(books)
			.filter(([, book]) => book === undefined)
			.map(([isbn]) => isbn);

		Promise.all([...isbnsToFetch].map((isbn) => this.#pluginManagerInstance.getBook(isbn))).then((results) => {
			// in case of disabled plugin, the results would be null
			const filteredResults = results.filter((result): result is BookEntry => Boolean(result));

			this.upsert(filteredResults);
		});

		return books;
	}

	stream(ctx: debug.DebugCtx, isbns: string[]) {
		// this is the function that will fire whenever there's data is emitted
		return new Observable<(BookEntry | undefined)[]>((subscriber) => {
			// listens to changes in docs with these isbns
			const emitter = this.#db._pouch.changes<BookEntry[]>({
				since: "now",
				live: true,
				include_docs: true,
				filter: (doc) => isbns.includes(doc._id.replace("books/", ""))
			});

			const initialState = from(this.get(isbns));

			// creates new obvs every time there's a change in the database, and replaces the old Observable
			const changeStream = newChangesStream<BookEntry[]>(ctx, emitter).pipe(
				// The change only triggers a new query (as changes are partial and we need the "all docs" update)
				switchMap(() => from(this.get(isbns)))
			);

			//subscribers receive updates in sequence
			concat(initialState, changeStream)
				.pipe(tap(debug.log(ctx, "books_stream:result:raw")))
				.subscribe((doc) => subscriber.next(doc));

			return () => emitter.cancel();
		});
	}
}

export const newBooksInterface = (db: DatabaseInterface, pluginManagerInstance?: PluginManager): BooksInterface => {
	return new Books(db, pluginManagerInstance);
};

// given these functions, could you explain why there's a conflict error
