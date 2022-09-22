/* eslint-disable @typescript-eslint/no-empty-function */
import { test as t } from 'vitest';

import {
	RawBook,
	RawSnap,
	RawNote,
	TransformNote,
	TransformSnap,
	MapWarehouses,
	CouchDocument,
	RawBookStock,
	TestConfig
} from '../types';

interface RawData {
	books: RawBook[];
	notes: RawNote[];
	snaps: RawSnap[];
}

interface GetNotesAndWarehouses {
	(n: number): {
		notes: CouchDocument[];
		snap: CouchDocument;
		warehouses: Record<string, CouchDocument>;
	};
}

export const defaultTransformBook = (b: { volumeInfo: Pick<RawBook['volumeInfo'], 'title'> }) => ({
	_id: b.volumeInfo.title
});
export const defaultTransformNote = (el: { id: string }) => ({ _id: el.id });
export const defaultTransformSnap = (sn: RawSnap) => ({
	_id: sn.id,
	books: sn.books.map(defaultTransformBook)
});

export class TestSetup {
	private readonly _books: CouchDocument[];
	private readonly _rawNotes: RawNote[];
	private readonly _rawSnaps: RawSnap[];

	_transformNote: TransformNote;
	_transformSnap: TransformSnap;
	_mapWarehouses: MapWarehouses;

	constructor(data: RawData, config: TestConfig) {
		const {
			transformBooks = defaultTransformBook,
			transformNotes = defaultTransformNote,
			transformSnaps = defaultTransformSnap,
			mapWarehouses = () => {}
		} = config;

		this._books = data.books.map(transformBooks);
		this._rawNotes = data.notes;
		this._rawSnaps = data.snaps;

		this._transformNote = transformNotes;
		this._transformSnap = transformSnaps;
		this._mapWarehouses = mapWarehouses;
	}

	test(
		name: string,
		cb: (books: CouchDocument[], getNotesAndWarehouses: GetNotesAndWarehouses) => Promise<void>
	) {
		const getNotesAndWarehouses: GetNotesAndWarehouses = (n: number) => {
			const notes = this._rawNotes.slice(0, n).map(this._transformNote);
			const rawSnap = this._rawSnaps[n - 1];

			const rawWarehouses: Record<string, RawSnap> = {};
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
