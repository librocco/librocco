import { concat, from, Observable, switchMap, tap } from "rxjs";

import { debug, wrapIter } from "@librocco/shared";

import { BookEntry, BooksInterface, DatabaseInterface } from "@/types";

import { newChangesStream, unwrapDocs } from "@/utils/pouchdb";

class Books implements BooksInterface {
	#db: DatabaseInterface;

	constructor(db: DatabaseInterface) {
		this.#db = db;
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
		const rawBooks = await this.#db._pouch
			.allDocs<BookEntry>({ keys: isbns.map((isbn) => `books/${isbn}`), include_docs: true })
			.then((docs) => unwrapDocs(docs));
		// The rows are returned in the same order as the supplied keys array.
		// The row for a nonexistent document will just contain an "error" property with the value "not_found".

		const combinedResults = wrapIter(isbns).zip(rawBooks);

		const existingBooks: BookEntry[] = [];
		// temp fix for isbn
		const fetchIsbns = combinedResults.map(([isbn, book]) => {
			if (book !== undefined) {
				existingBooks.push(book);
				return;
			}

			return isbn;
		});

		const fetchedBooks = await Promise.all(fetchIsbns.map((isbn = "") => pluginManager.getBook(isbn)));
		this.upsert(fetchedBooks);

		return [...fetchedBooks, ...existingBooks];
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

			// only use latest change to query allDocs
			const changeStream = newChangesStream<BookEntry[]>(ctx, emitter).pipe(
				// The change only triggers a new query (as changes are partial and we need the "all docs" update)
				switchMap(() => from(this.get(isbns)))
			);

			// call plugin here
			concat(initialState, changeStream)
				.pipe(tap(debug.log(ctx, "books_stream:result:raw")))
				.subscribe((doc) => subscriber.next(doc));

			return () => emitter.cancel();
		});
	}
}

export const newBooksInterface = (db: DatabaseInterface): BooksInterface => {
	return new Books(db);
};

const pluginManager = {
	getBook: (isbn: string): Promise<BookEntry> => {
		// This is a mock function that returns a Promise resolving to a dummy book object after 300 ms
		// would be replaced with a call to real plugin manager

		return new Promise((resolve) => {
			setTimeout(() => {
				resolve({
					title: `Book with ISBN ${isbn}`,
					authors: "Some Author",
					isbn,
					price: 10
				});
			}, 300);
		});
	}
};
