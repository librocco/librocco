import { Search } from "js-search";
import { map, Observable, ReplaySubject, share } from "rxjs";

import { debug } from "@librocco/shared";

import { BookEntry, BooksInterface, SearchIndex } from "@/types";
import { DatabaseInterface, DatabaseSchema } from "./types";

class Books implements BooksInterface {
	#db: DatabaseInterface;
	#searchIndexStream?: Observable<SearchIndex>;

	constructor(db: DatabaseInterface) {
		this.#db = db;
	}

	private _streamAll(ctx: debug.DebugCtx = {}) {
		return this.#db._stream(ctx, (db) => db.selectFrom("books").selectAll()).pipe(map((rows) => rows.map(bookRowToBookEntry)));
	}

	/**
	 * Creates a search index stream, assigns it to this.#searchIndexStream and multicasts it.
	 * Returns the created stream.
	 */
	private _createSearchIndexStream() {
		const searchStreamCache = new ReplaySubject<SearchIndex>();
		return (this.#searchIndexStream = this._streamAll().pipe(
			map(createSearchIndex),
			// Share the stream in case multiple subscribers request it (to prevent duplication as the index takes up quite a bit of memory)
			// Reset the stream when there are no more subscribers (for the same reasons as above)
			share({ connector: () => searchStreamCache, resetOnRefCountZero: true })
		));
	}

	async get(_: debug.DebugCtx, isbns: string[]): Promise<BookEntry[]> {
		const conn = await this.#db._connection();

		const bookDataMap = await conn
			.selectFrom("books")
			.where("isbn", "in", isbns)
			.selectAll()
			.execute()
			.then((books) => new Map(books.map((b) => [b.isbn, bookRowToBookEntry(b)])));

		return isbns.map((isbn) => bookDataMap.get(isbn));
	}

	async upsert(_: debug.DebugCtx, books: Partial<BookEntry>[]) {
		const values = books
			.filter((b): b is BookEntry => !!b.isbn)
			// Updated at field signalises that (at least some of) the book data had been fetched / updated.
			// Here we infer that from the entry having more than the isbn field.
			.map((book) => (Object.values(book).length > 1 ? { ...book, updatedAt: new Date().toISOString() } : book))
			// Convert the (out of print) boolean to a number.
			.map(({ outOfPrint, ...book }) => (outOfPrint !== undefined ? { ...book, outOfPrint: outOfPrint ? 1 : 0 } : book));

		if (!values.length) return;

		await this.#db._update((db) =>
			db
				.insertInto("books")
				.values(values)
				.onConflict((oc) =>
					oc.column("isbn").doUpdateSet((du) => ({
						isbn: du.fn.coalesce(du.ref("excluded.isbn"), du.ref("books.isbn")),
						authors: du.fn.coalesce(du.ref("excluded.authors"), du.ref("books.authors")),
						category: du.fn.coalesce(du.ref("excluded.category"), du.ref("books.category")),
						editedBy: du.fn.coalesce(du.ref("excluded.editedBy"), du.ref("books.editedBy")),
						outOfPrint: du.fn.coalesce(du.ref("excluded.outOfPrint"), du.ref("books.outOfPrint")),
						price: du.fn.coalesce(du.ref("excluded.price"), du.ref("books.price")),
						publisher: du.fn.coalesce(du.ref("excluded.publisher"), du.ref("books.publisher")),
						title: du.fn.coalesce(du.ref("excluded.title"), du.ref("books.title")),
						updatedAt: du.fn.coalesce(du.ref("excluded.updatedAt"), du.ref("books.updatedAt")),
						year: du.fn.coalesce(du.ref("excluded.year"), du.ref("books.year"))
					}))
				)
				.execute()
		);
	}

	stream(ctx: debug.DebugCtx, isbns: string[]): Observable<(BookEntry | undefined)[]> {
		const bookDataStore = this.#db._stream(ctx, (db) => db.selectFrom("books").where("isbn", "in", isbns).selectAll());

		return bookDataStore.pipe(
			// First we construct a lookup map: { isbn => book data }
			map((books) => new Map(books.map((b) => [b.isbn, bookRowToBookEntry(b)]))),
			// We go over the requested isbns and merge the book data to keep the order (passing undefined if respective entry not found)
			map((m) => isbns.map((isbn) => m.get(isbn)))
		);
	}

	streamPublishers(ctx: debug.DebugCtx = {}) {
		return this.#db
			._stream(ctx, (db) => db.selectFrom("books").select("publisher").distinct())
			.pipe(map((res) => res.map((r) => r.publisher).filter(Boolean)));
	}

	// TODO: investigate SQLite (native) FTS5 instead of js-search
	streamSearchIndex() {
		return this.#searchIndexStream ?? this._createSearchIndexStream();
	}
}

export const createBooksInterface = (db: DatabaseInterface): BooksInterface => new Books(db);

const bookRowToBookEntry = (row: DatabaseSchema["books"]): BookEntry | undefined =>
	!row
		? undefined
		: Object.fromEntries(
				[
					["isbn", row.isbn],
					["title", row.title],
					["price", row.price],
					["year", row.year],
					["authors", row.authors],
					["publisher", row.publisher],
					["editedBy", row.editedBy],
					["outOfPrint", !!row.outOfPrint],
					["category", row.category],
					["updatedAt", row.updatedAt]
				].filter(([, val]) => !!val)
			);

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
