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
		await Promise.all(
			bookEntries.map((b) => {
				return new Promise<void>((resolve, reject) => {
					const bookEntry = { ...b, _id: `books/${b.isbn}` };
					this.#db._pouch
						.put(bookEntry)
						.then(() => resolve())
						.catch((err) => {
							// eslint-disable-next-line @typescript-eslint/no-explicit-any
							if ((err as any).status !== 409) reject(err);

							this.#db._pouch.get(bookEntry._id).then((bookDoc) => {
								this.#db._pouch.put({ ...bookDoc, ...bookEntry }).then(() => {
									resolve();
								});
							});
						});
				});
			})
		);
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

		const results = await Promise.all([...isbnsToFetch].map((isbn) => this.#pluginManagerInstance.getBook(isbn)));
		// in case of disab;ed plugin, the results would be null
		const filteredResults = results.filter((result): result is BookEntry => Boolean(result));
		if (filteredResults.length) {
			this.upsert(filteredResults);
		}
		return books;
	}

	stream(ctx: debug.DebugCtx, isbns: string[]) {
		return new Observable<(BookEntry | undefined)[]>((subscriber) => {
			const emitter = this.#db._pouch.changes<BookEntry[]>({
				since: "now",
				live: true,
				include_docs: true,
				filter: (doc) => isbns.includes(doc._id.replace("books/", ""))
			});

			const initialState = from(this.get(isbns));

			const changeStream = newChangesStream<BookEntry[]>(ctx, emitter).pipe(
				// The change only triggers a new query (as changes are partial and we need the "all docs" update)
				switchMap(() => from(this.get(isbns)))
			);

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
