/* eslint-disable @typescript-eslint/no-empty-function */
import { test as t } from 'vitest';

import { RawBook, RawSnap, RawNote, CouchDocument, RawBookStock, TransformConfig } from '../types';

interface RawData {
	books: RawBook[];
	notes: RawNote[];
	snaps: RawSnap[];
}

interface GetNotesAndWarehouses {
	(n: number): {
		notes: CouchDocument[];
		snap: CouchDocument;
		warehouses: CouchDocument[];
	};
}

interface TestFunction {
	(books: CouchDocument[], getNotesAndWarehouses: GetNotesAndWarehouses): Promise<void>;
}

interface Test {
	(name: string, fn: TestFunction): void;
}

export const defaultTransformBook = (b: { volumeInfo: Pick<RawBook['volumeInfo'], 'title'> }) => ({
	_id: b.volumeInfo.title
});
export const defaultTransformNote = (el: { id: string }) => ({ _id: el.id });
export const defaultTransformSnap = (sn: RawSnap) => ({
	_id: 'all-warehouses',
	books: sn.books.map(defaultTransformBook)
});
export const defaultTransformWarehouse = (wh: RawSnap) => ({
	_id: wh.id,
	books: wh.books.map(defaultTransformBook)
});

export const newModel = (data: RawData, config: TransformConfig) => {
	const {
		transformBooks = defaultTransformBook,
		transformNotes = defaultTransformNote,
		transformSnaps = defaultTransformSnap,
		transformWarehouse = defaultTransformSnap,
		mapWarehouses = () => {}
	} = config;

	const books = data.books.map(transformBooks);

	const test: Test = (name, cb) => {
		const getNotesAndWarehouses: GetNotesAndWarehouses = (n: number) => {
			const notes = data.notes.slice(0, n).map(transformNotes);
			const rawSnap = data.snaps[n - 1];

			const rawWarehouses: Record<string, RawSnap> = {};
			const addToWarehouse = (wName: string, book: RawBookStock) => {
				const wh = rawWarehouses[wName] || { id: wName, books: [] };

				rawWarehouses[wName] = { ...wh, id: wName, books: [...wh.books, book] };
			};

			rawSnap.books.forEach((b) => mapWarehouses(b, addToWarehouse));

			const snap = transformSnaps(rawSnap);
			const warehouses = Object.values(rawWarehouses).map((w) => transformWarehouse(w));

			console.log(JSON.stringify(warehouses, null, 2));

			return { notes, snap, warehouses };
		};

		t(name, async () => {
			await cb(books, getNotesAndWarehouses);
		});
	};

	return {
		test
	};
};
