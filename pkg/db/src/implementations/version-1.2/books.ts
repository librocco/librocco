import { concat, from, map, Observable, switchMap, tap } from "rxjs";

import { debug } from "@librocco/shared";

import { BookEntry, BooksInterface } from "@/types";
import { DatabaseInterface, PublishersListRow } from "./types";

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
		const books = await this.#db._pouch
			.allDocs<BookEntry>({ keys: isbns.map((isbn) => `books/${isbn}`), include_docs: true })
			// The rows are returned in the same order as the supplied keys array.
			// The row for a nonexistent document will just contain an "error" property with the value "not_found".
			.then((docs) => unwrapDocs(docs));
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

	streamPublishers(ctx: debug.DebugCtx): Observable<string[]> {
		return this.#db
			.view<PublishersListRow>("v1_list/publishers")
			.stream(ctx, { group_level: 1 })
			.pipe(
				tap(debug.log(ctx, "books:publishers_stream:raw")),
				map(({ rows }) => rows.map(({ key }) => key)),
				tap(debug.log(ctx, "books:publishers_stream:transformed"))
			);
	}
}

export const newBooksInterface = (db: DatabaseInterface): BooksInterface => {
	return new Books(db);
};
