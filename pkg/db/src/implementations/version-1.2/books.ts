import { concat, from, map, Observable, switchMap, tap } from "rxjs";

import { debug } from "@librocco/shared";

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
		const rawBooks = await this.#db._pouch.allDocs<BookEntry>({ keys: isbns.map((isbn) => `books/${isbn}`), include_docs: true });
		// The rows are returned in the same order as the supplied keys array.
		// The row for a nonexistent document will just contain an "error" property with the value "not_found".
		return unwrapDocs(rawBooks);
	}

	stream(ctx: debug.DebugCtx, isbns: string[]) {
		return new Observable<(BookEntry | undefined)[]>((subscriber) => {
			const emitter = this.#db._pouch.changes<BookEntry[]>({
				since: "now",
				live: true,
				include_docs: true,
				filter: (doc) => isbns.includes(doc._id.replace("books/", ""))
			});

			const initialState = from(
				new Promise<PouchDB.Core.AllDocsResponse<BookEntry>>((resolve) => {
					this.#db._pouch
						.allDocs<BookEntry>({ keys: isbns.map((isbn) => `books/${isbn}`), include_docs: true })
						.then((res) => {
							debug.log(ctx, "books_stream:initial_query:result")(res);
							return resolve(res);
						})
						.catch(debug.log(ctx, "books_stream:initial_query:error"));
				})
			);

			const changeStream = newChangesStream<BookEntry[]>(ctx, emitter).pipe(
				// The change only triggers a new query (as changes are partial and we need the "all docs" update)
				switchMap(() =>
					from(
						new Promise<PouchDB.Core.AllDocsResponse<BookEntry>>((resolve) => {
							this.#db._pouch
								.allDocs<BookEntry>({ keys: isbns.map((isbn) => `books/${isbn}`), include_docs: true })
								.then((res) => {
									debug.log(ctx, "books_stream:change_query:res")(res);
									return resolve(res);
								})
								.catch(debug.log(ctx, "books_stream:change_query:error"));
						})
					)
				)
			);

			concat(initialState, changeStream)
				.pipe(
					tap(debug.log(ctx, "books_stream:result:raw")),
					map(unwrapDocs),
					tap(debug.log(ctx, "books_stream:result:transformed"))
				)
				.subscribe((doc) => subscriber.next(doc));

			return () => emitter.cancel();
		});
	}
}

export const newBooksInterface = (db: DatabaseInterface): BooksInterface => {
	return new Books(db);
};
