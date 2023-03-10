import { BookEntry, BookInterface, DatabaseInterface } from '@/types';
import { newChangesStream } from '@/utils/pouchdb';
import { debug } from '@librocco/shared';

import { concat, from, map, Observable, switchMap, tap } from 'rxjs';

class Book implements BookInterface {
	#db: DatabaseInterface;

	constructor(db: DatabaseInterface) {
		this.#db = db;
		return this;
	}

	async upsert(bookEntries: BookEntry[]): Promise<void> {
		await Promise.all(
			bookEntries.map(async (b) => {
				// eslint-disable-next-line no-async-promise-executor
				return new Promise<void>(async (resolve, reject) => {
					const bookEntry = { ...b, _id: `books/${b.isbn}` };
					try {
						await this.#db._pouch.put(bookEntry);
						resolve();
					} catch (err) {
						// eslint-disable-next-line @typescript-eslint/no-explicit-any
						if ((err as any).status !== 409) reject();

						const bookDoc = await this.#db._pouch.get(bookEntry._id);
						await this.#db._pouch.put({ ...bookDoc, ...bookEntry });
						resolve();
					}
				});
			})
		);
	}

	async get(isbns: string[]): Promise<(BookEntry | undefined)[]> {
		const rawBooks = await this.#db._pouch.allDocs<BookEntry>({ keys: isbns.map((isbn) => `books/${isbn}`), include_docs: true });
		// The rows are returned in the same order as the supplied keys array.
		// The row for a nonexistent document will just contain an "error" property with the value "not_found".

		const bookDocs = rawBooks.rows.map(({ doc }) => {
			if (!doc) return undefined;
			// eslint-disable-next-line @typescript-eslint/no-unused-vars
			const { _id, _rev, ...rest } = doc;
			return rest;
		});

		return bookDocs;
	}

	stream(isbns: string[], ctx: debug.DebugCtx): Observable<BookEntry[]> {
		return new Observable<BookEntry[]>((subscriber) => {
			const emitter = this.#db._pouch.changes<BookEntry[]>({
				since: 'now',
				live: true,
				include_docs: true,
				filter: (doc) => isbns.includes(doc._id)
			});

			const initialPromise = this.#db._pouch
				.allDocs<(BookEntry | undefined)[]>({ keys: isbns.map((isbn) => `books/${isbn}`), include_docs: true })
				.then((res) => {
					debug.log(ctx, 'books_stream:initial_query:result')(res);
					return res;
				})
				// This shouldn't really happen, but as an edge case, we don't want to break the entire app
				.catch((err) => {
					debug.log(ctx, 'document_stream:initial_query:error')(err);
					debug.log(ctx, 'document_stream:initial_query:error:fallback')({ rows: [] });
					return { rows: [] };
				});
			const initialState = from(initialPromise).pipe(
				map(({ rows }) => {
					// const { _id, _rev, ...rest } = doc || {}
					return rows.map(({ doc }) => {
						if (!doc) return undefined;
						// eslint-disable-next-line @typescript-eslint/no-unused-vars
						const { _id, _rev, ...rest } = doc;
						return rest;
					});
				})
			);
			const changeStream = newChangesStream<(BookEntry | undefined)[]>(emitter, ctx).pipe(
				// The change only triggers a new query (as changes are partial and we require the full view update)
				switchMap(() =>
					from(
						new Promise<PouchDB.Core.AllDocsResponse<BookEntry>>((resolve) => {
							this.#db._pouch
								.allDocs<BookEntry>({ keys: isbns.map((isbn) => `books/${isbn}`), include_docs: true })
								.then((res) => {
									debug.log(ctx, 'books_stream:change_query:result')(res);
									return resolve(res);
								})
								.catch((err) => {
									debug.log(ctx, 'books_stream:change_query:error')(err);
								});
						})
					)
				),
				tap(debug.log(ctx, 'books_stream:change')),
				map(({ rows }) => {
					rows.map(({ doc }) => {
						// eslint-disable-next-line @typescript-eslint/no-unused-vars
						const { _id, _rev, ...rest } = doc || {};
						return [rest];
					});
				}),
				tap(debug.log(ctx, 'books_stream:change:transformed'))
			);

			concat(initialState, changeStream)
				.pipe(
					tap(debug.log(ctx, 'books_stream:result:raw')),
					map((doc) => doc),
					tap(debug.log(ctx, 'books_stream:result:transformed'))
				)
				.subscribe((doc) => subscriber.next(doc));

			return () => emitter.cancel();
		});
	}
}

export const newBookInterface = (db: DatabaseInterface): BookInterface => {
	return new Book(db);
};
