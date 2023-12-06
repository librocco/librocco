import { concat, from, map, Observable, switchMap, tap } from "rxjs";
import { Search } from "js-search";

import { debug, wrapIter } from "@librocco/shared";

import { BookEntry, BooksInterface, CouchDocument, SearchIndex } from "@/types";
import { DatabaseInterface, PublishersListRow } from "./types";

import { newChangesStream, unwrapDocs } from "@/utils/pouchdb";

class Books implements BooksInterface {
	#db: DatabaseInterface;

	#searchIndex: SearchIndex | undefined;

	constructor(db: DatabaseInterface) {
		this.#db = db;
	}

	private streamChanges() {
		return newChangesStream<unknown[]>(
			{},
			this.#db._pouch.changes({ since: "now", live: true, filter: (doc) => doc._id.startsWith("books/") })
		);
	}

	private getAllBooks(): Promise<BookEntry[]> {
		return this.#db._pouch
			.allDocs<BookEntry>({ include_docs: true, startkey: "books/", endkey: "books/\uffff" })
			.then(unwrapDocs)
			.then((books) => books.filter((book): book is BookEntry => Boolean(book)));
	}

	async upsert(docsToUpsert: BookEntry[]): Promise<void> {
		if (!docsToUpsert.length) return;

		// Get revs for all updates
		const docs = await this.#db._pouch
			.allDocs<BookEntry>({
				keys: docsToUpsert.map(({ isbn }) => `books/${isbn}`),
				include_docs: true
			} as PouchDB.Core.AllDocsWithKeysOptions)
			.then(({ rows }) => rows.map(({ doc }) => doc as CouchDocument<BookEntry> | undefined));

		const updates = wrapIter(docsToUpsert)
			.map((doc) => ({ _id: `books/${doc.isbn}`, ...doc }))
			.zip(docs)
			.map(([update, { _rev } = { _rev: "" }]) => (_rev ? { ...update, _rev } : update));

		await this.#db._pouch.bulkDocs([...updates]);
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
			.map(([isbn]) => isbn)
			.array();

		// The update is done in the background, so we're not awaiting the promises to resolve.
		// Instead, we're returning the current state and the next state (state updated with books)
		// will trigger the next stream (in case of listening to stream).
		//
		// For now we can live with 'books.get()' returning the state from the db, and, only on next
		// request return updated state (with book data fetched for books not in the db at time of first request).
		// TODO: Add a flag to explicitly await this on request (resulting in a full current state, after the books have been fetched)
		this.#db.plugin("book-fetcher").fetchBookData(isbnsToFetch).then(this.upsert);

		return books;
	}

	private async createSearchIndex() {
		const index = new Search("isbn");
		index.addIndex("isbn");
		index.addIndex("title");
		index.addIndex("authors");
		index.addIndex("publisher");
		index.addIndex("editedBy");

		// TODO: We might want to get the relevantBooksOnly (to reduce the size of the built index),
		// but that's a can of worms of sorts, and we should revisit only if we see performance issues.
		index.addDocuments(await this.getAllBooks());

		this.#searchIndex = index;
		return index;
	}

	streamSearchIndex() {
		return concat(from(Promise.resolve()), this.streamChanges()).pipe(switchMap(() => this.createSearchIndex()));
	}

	stream(ctx: debug.DebugCtx, isbns: string[]) {
		return new Observable<(BookEntry | undefined)[]>((subscriber) => {
			const emitter = this.#db._pouch.changes<BookEntry[]>({
				since: "now",
				live: true,
				include_docs: true,
				filter: (doc) => isbns.includes(doc._id.replace("books/", ""))
			});

			const initialState = from(this.get(isbns)).pipe(tap(debug.log(ctx, "books:initial_state")));

			const changeStream = newChangesStream<BookEntry[]>(ctx, emitter).pipe(
				tap(debug.log(ctx, "books:change")),
				// The change only triggers a new query (as changes are partial and we need the "all docs" update)
				switchMap(() => from(this.get(isbns)).pipe(tap(debug.log(ctx, "books:change:stream"))))
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
