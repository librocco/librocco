/* eslint-disable @typescript-eslint/no-empty-function */
import { test as t } from 'vitest';

import {
	RawBook,
	RawSnap,
	RawNote,
	GetNotesAndWarehouses,
	TestSetup,
	Test,
	MapWarehouses
} from '../types';

import { newDB } from './utils';

// #region types
interface RawData {
	books: RawBook[];
	notes: RawNote[];
	snaps: RawSnap[];
}

// #endregion types

// #region newModal
export const newModel = (rawData: RawData, setup: TestSetup) => {
	const {
		transformBooks = defaultTransformBook,
		transformNotes = defaultTransformNote,
		transformSnaps = defaultTransformSnap,
		transformWarehouse = defaultTransformSnap,
		mapWarehouses = () => {}
	} = setup.transform;

	const books = rawData.books.map(transformBooks);

	const getNotesAndWarehouses: GetNotesAndWarehouses = (n: number) => {
		const notes = rawData.notes.slice(0, n).map(transformNotes);
		const rawSnap = rawData.snaps[n - 1];
		const rawWarehouses = warehousesFromSnap(rawSnap, mapWarehouses);

		const snap = transformSnaps(rawSnap);
		const warehouses = Object.values(rawWarehouses).map((w) => transformWarehouse(w));

		return { notes, snap, warehouses };
	};

	const data = { books, getNotesAndWarehouses };

	const test: Test = (name, cb) => {
		t(name, async () => {
			// Get new db per test basis
			const db = await newDB();

			await cb(data, setup.createDBInterface(db));

			// Destroy the db after the test
			db.destroy();
		});
	};

	return {
		test
	};
};
// #endregion newModal

// #region defaultTransformers
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
// #endregion defaultTransformers

// #region helpers
const warehousesFromSnap = (snap: RawSnap, mapWarehouses: MapWarehouses): RawSnap[] => {
	const warehouseRecord = snap.books.reduce((acc, b) => {
		let wName = '';
		mapWarehouses(b, (w: string) => (wName = w));

		if (!wName) return acc;

		const warehouse = acc[wName] || { id: wName, books: [] };

		return { ...acc, [wName]: { ...warehouse, books: [...warehouse.books, b] } };
	}, {} as Record<string, RawSnap>);

	return Object.values(warehouseRecord);
};
// #endregion helpers
