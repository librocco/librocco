import { concat, from, map, Observable, ReplaySubject, share, switchMap, tap } from "rxjs";
import { Search } from "js-search";

import { debug, wrapIter } from "@librocco/shared";

import { BookEntry, BooksInterface } from "@/types";

import { DatabaseInterface as BaseDatabaseInterface, PublishersListRow, CouchDocument } from "./types";

import { newView } from "./view";

import { newChangesStream, unwrapDocs } from "./utils";

class Books implements BooksInterface {
	#db: BaseDatabaseInterface;

	#searchIndexStream?: Observable<Search>;

	constructor(db: BaseDatabaseInterface) {
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

	async upsert(_: debug.DebugCtx, _docs: (Partial<BookEntry> | undefined)[]): Promise<void> {
		// Filter out (possibly) undefined inputs

		const docsToUpsert = _docs.filter((d): d is BookEntry => Boolean(d));
		if (!docsToUpsert.length) return;

		// Get revs for all updates
		const docs = await this.#db._pouch
			.allDocs<BookEntry>({
				keys: docsToUpsert.map(({ isbn }) => `books/${isbn}`),
				include_docs: true
			} as PouchDB.Core.AllDocsWithKeysOptions)
			.then(({ rows }) => rows.map(({ doc }) => doc as CouchDocument<BookEntry> | undefined));

		const updates = wrapIter(docsToUpsert)
			// If entry has any field other than "isbn", add/update the 'updatedAt' field.
			// If entry is isbn-only - we don't have any book data - no 'updatedAt' is added as this signals that the book data should be fetched at some point.
			.map((doc) => (Object.keys(doc).some((k) => k !== "isbn") ? { ...doc, updatedAt: new Date().toISOString() } : doc))
			.map((doc) => ({ _id: `books/${doc.isbn}`, ...doc }))
			.zip(docs)
			.map(([update, existing = {}]) => ({ ...existing, ...update }))
			.array();

		await this.#db._pouch.bulkDocs(updates);
	}

	async get(_: debug.DebugCtx, isbns: string[]): Promise<(BookEntry | undefined)[]> {
		const books = await this.#db._pouch
			.allDocs<BookEntry>({ keys: isbns.map((isbn) => `books/${isbn}`), include_docs: true })
			// The rows are returned in the same order as the supplied keys array.
			// The row for a nonexistent document will just contain an "error" property with the value "not_found".
			.then((docs) => unwrapDocs(docs))

			.catch((err) => {
				if ((err as any).status === 404 || (err as any).status === 401) return [];
				// For all other errors, throw
				throw err;
			});

		return books;
	}

	/**
	 * Creates a search index stream, assigns it to this.#searchIndexStream and multicasts it.
	 * Returns the created stream.
	 */
	private createSearchIndexStream() {
		const searchStreamCache = new ReplaySubject<Search>();
		return (this.#searchIndexStream = concat(from(Promise.resolve()), this.streamChanges()).pipe(
			switchMap(() => from(this.getAllBooks())),
			map(createSearchIndex),
			// Share the stream in case multiple subscribers request it (to prevent duplication as the index takes up quite a bit of memory)
			// Reset the stream when there are no more subscribers (for the same reasons as above)
			share({ connector: () => searchStreamCache, resetOnRefCountZero: true })
		));
	}

	streamSearchIndex() {
		return this.#searchIndexStream ?? this.createSearchIndexStream();
	}

	stream(ctx: debug.DebugCtx, isbns: string[]) {
		return new Observable<(BookEntry | undefined)[]>((subscriber) => {
			const emitter = this.#db._pouch.changes<BookEntry[]>({
				since: "now",
				live: true,
				include_docs: true,
				filter: (doc) => isbns.includes(doc._id.replace("books/", ""))
			});

			const initialState = from(this.get(ctx, isbns)).pipe(tap(debug.log(ctx, "books:initial_state")));
			const changeStream = newChangesStream<BookEntry[]>(ctx, emitter).pipe(
				tap(debug.log(ctx, "books:change")),
				// The change only triggers a new query (as changes are partial and we need the "all docs" update)
				switchMap(() => from(this.get(ctx, isbns)).pipe(tap(debug.log(ctx, "books:change:stream"))))
			);

			concat(initialState, changeStream)
				.pipe(tap(debug.log(ctx, "books_stream:result:raw")))
				.subscribe((doc) => subscriber.next(doc));

			return () => emitter.cancel();
		});
	}

	streamPublishers(ctx: debug.DebugCtx): Observable<string[]> {
		return newView<PublishersListRow>(this.#db._pouch, "v1_list/publishers")
			.stream(ctx, { group_level: 1 })
			.pipe(
				tap(debug.log(ctx, "books:publishers_stream:raw")),
				map(({ rows }) => rows.map(({ key }) => key)),
				tap(debug.log(ctx, "books:publishers_stream:transformed"))
			);
	}
}

export const newBooksInterface = (db: BaseDatabaseInterface): BooksInterface => {
	return new Books(db);
};

const createSearchIndex = (books: BookEntry[]) => {
	const index = new Search("isbn");
	index.addIndex("isbn");
	index.addIndex("title");
	index.addIndex("authors");
	index.addIndex("publisher");
	index.addIndex("editedBy");

	index.addDocuments(books);

	return index;
};
