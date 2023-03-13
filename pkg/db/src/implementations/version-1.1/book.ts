import { BookEntry, BookInterface, DatabaseInterface } from '@/types';
import { newChangesStream, unwrapDocs } from '@/utils/pouchdb';
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
		return unwrapDocs(rawBooks);
	}

	stream(isbns: string[], ctx: debug.DebugCtx) {
		return new Observable<(BookEntry | undefined)[]>((subscriber) => {
			const emitter = this.#db._pouch.changes<BookEntry[]>({
				since: 'now',
				live: true,
				include_docs: true,
				filter: (doc) => isbns.includes(doc._id)
			});

			const initialState = from(
				new Promise<PouchDB.Core.AllDocsResponse<BookEntry>>((resolve) => {
					this.#db._pouch
						.allDocs<BookEntry>({ keys: isbns.map((isbn) => `books/${isbn}`), include_docs: true })
						.then((res) => {
							debug.log(ctx, 'books_stream:initial_query:result')(res);
							return resolve(res);
						})
						.catch(debug.log(ctx, 'books_stream:initial_query:error'));
				})
			);

			const changeStream = newChangesStream<BookEntry[]>(emitter, ctx).pipe(
				// The change only triggers a new query (as changes are partial and we the all docs update)
				switchMap(() =>
					from(
						new Promise<PouchDB.Core.AllDocsResponse<BookEntry>>((resolve) => {
							this.#db._pouch
								.allDocs<BookEntry>({ keys: isbns.map((isbn) => `books/${isbn}`), include_docs: true })
								.then((res) => {
									debug.log(ctx, 'books_stream:change_query:res')(res);
									return resolve(res);
								})
								.catch(debug.log(ctx, 'books_stream:change_query:error'));
						})
					)
				)
			);

			concat(initialState, changeStream)
				.pipe(
					tap(debug.log(ctx, 'books_stream:result:raw')),
					map(unwrapDocs),
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
