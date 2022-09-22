/* eslint-disable @typescript-eslint/no-explicit-any */
import { test as t } from 'vitest';
import { RawBook, RawBookStock, RawDBSnap, RawNote } from '../types/raw-data';

type CouchDocument<Doc extends Record<string, any> = Record<string, any>> = { _id: string } & Doc;

interface TestDataLoader {
	getBooks: () => Promise<RawBook[]>;
	getNotes: () => Promise<RawNote[]>;
	getSnaps: () => Promise<RawDBSnap[]>;
}

interface TransformBook {
	(book: RawBook): CouchDocument;
}

interface TransformNote {
	(note: RawNote): CouchDocument;
}

interface AddToWarehouse {
	(wName: string, book: RawBookStock): void;
}

interface TransformSnap {
	(db: RawDBSnap): CouchDocument;
}

interface MapWarehouses {
	(book: RawBookStock, addToWarehouse: AddToWarehouse): void;
}

interface GetNotesAndWarehouses {
	(n: number): {
		notes: CouchDocument[];
		snap: CouchDocument;
		warehouses: Record<string, CouchDocument>;
	};
}

export class Runner {
	private _rawBooks: RawBook[] = [];
	private _rawNotes: RawNote[] = [];
	private _rawSnaps: RawDBSnap[] = [];

	async loadData(loader: TestDataLoader) {
		const [rawBooks, rawNotes, rawSnaps] = await Promise.all([
			loader.getBooks(),
			loader.getNotes(),
			loader.getSnaps()
		]);

		this._rawBooks = rawBooks;
		this._rawNotes = rawNotes;
		this._rawSnaps = rawSnaps;
	}

	newCase(config: TestConfig): Case {
		return new Case(
			{
				books: this._rawBooks,
				notes: this._rawNotes,
				snaps: this._rawSnaps
			},
			config
		);
	}
}

interface RawData {
	books: RawBook[];
	notes: RawNote[];
	snaps: RawDBSnap[];
}
interface TestConfig {
	transformBooks: TransformBook;
	transformNotes: TransformNote;
	transformSnaps: TransformSnap;
	mapWarehouses: MapWarehouses;
}

class Case {
	private readonly _books: CouchDocument[];
	private readonly _rawNotes: RawNote[];
	private readonly _rawSnaps: RawDBSnap[];

	_transformNote: TransformNote;
	_transformSnap: TransformSnap;
	_mapWarehouses: MapWarehouses;

	constructor(data: RawData, config: TestConfig) {
		this._books = data.books.map(config.transformBooks);
		this._rawNotes = data.notes;
		this._rawSnaps = data.snaps;

		this._transformNote = config.transformNotes;
		this._transformSnap = config.transformSnaps;
		this._mapWarehouses = config.mapWarehouses;
	}

	test(
		name: string,
		cb: (books: CouchDocument[], getNotesAndWarehouses: GetNotesAndWarehouses) => Promise<void>
	) {
		const getNotesAndWarehouses: GetNotesAndWarehouses = (n: number) => {
			const notes = this._rawNotes.slice(0, n).map(this._transformNote);
			const rawSnap = this._rawSnaps[n - 1];

			const rawWarehouses: Record<string, RawDBSnap> = {};
			const addToWarehouse = (wName: string, book: RawBookStock) => {
				const wh = rawWarehouses[wName] || { id: wName, books: [] };

				rawWarehouses[wName] = { ...wh, books: [...wh.books, book] };
			};

			rawSnap.books.forEach((b) => this._mapWarehouses(b, addToWarehouse));

			const snap = this._transformSnap(rawSnap);
			const warehouses = Object.entries(rawWarehouses).reduce(
				(acc, [wName, w]) => ({ ...acc, [wName]: this._transformSnap(w) }),
				{}
			);

			return { notes, snap, warehouses };
		};

		t(name, async () => {
			await cb(this._books, getNotesAndWarehouses);
		});
	}
}
