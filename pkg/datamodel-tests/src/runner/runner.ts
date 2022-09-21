/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { test as t } from 'vitest';
import { RawBook, RawDBSnap, RawNote } from '../types/raw-data';

type CouchDocument<Doc extends Record<string, any> = Record<string, any>> = { _id: string } & Doc;

interface TestDataLoader {
	getBooks: () => RawBook[];
	getNotes: () => RawNote[];
	getSnaps: () => RawDBSnap[];
}

interface TransformBook {
	(book: RawBook): CouchDocument;
}

interface TransformNote {
	(note: RawNote): CouchDocument;
}

// interface AddToWarehouse {
// 	(warehouse: string, book: Record<string, any>): void;
// }

interface TransformSnap {
	(db: RawDBSnap): CouchDocument;
}

interface GetNotesAndWarehouses {
	(n: number): { notes: CouchDocument[]; snap: CouchDocument };
}

export class Runner {
	private _rawBooks: RawBook[] = [];
	private _rawNotes: RawNote[] = [];
	private _rawSnaps: RawDBSnap[] = [];

	private _books: CouchDocument[] = [];
	private _transformNotes: null | TransformNote = null;
	private _transformSnap: null | TransformSnap = null;

	async loadData(loader: TestDataLoader) {
		this._rawBooks = loader.getBooks();
		this._rawNotes = loader.getNotes();
		this._rawSnaps = loader.getSnaps();
	}

	/**
	 * A function applied to each book entry to
	 * transform it from the raw data to the proposed data model.
	 *
	 * The proposed data structure can be passed as a type parameter
	 * for type safety while writing the transform function, e.g.
	 *
	 * ```typescript
	 * transformBooks<BookInterface>(...)
	 * ```
	 */
	transformBooks(transform: TransformBook) {
		this._books = this._rawBooks.map(transform);
	}

	/**
	 * A function applied to each note entry to
	 * transform it from the raw data to the proposed data model.
	 *
	 * The proposed data structure can be passed as a type parameter
	 * for type safety while writing the transform function, e.g.
	 *
	 * ```typescript
	 * transformNotes<NoteInterface>(...)
	 * ```
	 */
	transformNotes(transform: TransformNote): void {
		this._transformNotes = transform;
	}

	/**
	 * A function applied to the database snapshot (database being a collection of all books in stock)
	 * to transform it from the raw data to the proposed data model. Additionally it provides a param
	 * `addToWarehouse` for warehouse grouping.
	 * @param {RawDBSnap} db raw snapshot of all the books in stock
	 * @param {AddToWarehouse} addToWarehouse a function called with warehouse name and a record to store to each warehouse
	 * if we wish to split the books by warehouses.
	 * (In that case, the "db", i.e. total book stock will still be stored, but also each warehouse, with its stock will be created as separate documents)
	 */
	transformSnap(transform: TransformSnap): void {
		this._transformSnap = transform;
	}

	test(
		name: string,
		cb: (books: CouchDocument[], getNotesAndWarehouses: GetNotesAndWarehouses) => Promise<void>
	) {
		const getNotesAndWarehouses: GetNotesAndWarehouses = (n: number) => {
			const notes = this._rawNotes.slice(0, n).map(this._transformNotes!);
			const snap = this._transformSnap!(this._rawSnaps[n - 1]);

			return { notes, snap };
		};

		t(name, async () => {
			await cb(this._books, getNotesAndWarehouses);
		});
	}

	//	newSetup(config: TestConfig) {}
}

// interface RawData {
// 	rawBooks: RawBook[];
// 	rawNotes: RawNote[];
// 	rawDBSnaps: RawDBSnap[];
// }

// class TestSetup {
// 	private _books: CouchDocument<B>[];
// 	private _rawNotes: RawNote[];
// 	private _rawDBSnaps: RawDBSnap[];
//
// 	constructor(rawData: RawData, config: TestConfig) {
// 		this._books = rawData.rawBooks.map(config.transformBooks);
// 		this._rawNotes = rawData.rawNotes;
// 		this._rawDBSnaps = rawData.rawDBSnaps;
// 	}
// }
