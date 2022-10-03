/* eslint-disable @typescript-eslint/no-empty-function */
import { test as t } from 'vitest';
import { randomUUID } from 'crypto';
import PouchDB from 'pouchdb';

import {
	RawSnap,
	RawNote,
	GetNotesAndWarehouses,
	Test,
	TestStock,
	TransformNote,
	TransformStock,
	RawBookStock,
	NoteType,
	MapWarehouses,
	ImplementationSetup,
	VolumeStock
} from '@/types';

// #region types
interface RawData {
	notes: RawNote[];
	snaps: RawSnap[];
}

// #endregion types

// #region newModal
export const newModel = (rawData: RawData, setup: ImplementationSetup) => {
	const getNotesAndWarehouses: GetNotesAndWarehouses = (n: number) => {
		const notes = rawData.notes.slice(0, n).map(transformNote);

		const fullStockRaw = rawData.snaps[n - 1];
		const fullStock = transformStock(fullStockRaw);

		const warehouses = mapWarehouses(fullStockRaw.books);

		return { notes, fullStock, warehouses };
	};

	const test: Test = (name, cb) => {
		t(name, async () => {
			// Get new db per test basis
			const pouchInstance = new PouchDB(randomUUID(), { adapter: 'memory' });
			const db = setup.newDatabase(pouchInstance);

			//			// Upload design documents (if any)
			//			const ddUpdates = setup.designDocuments?.map((dd) => db.put(dd));
			//			if (ddUpdates) {
			//				await Promise.all(ddUpdates);
			//			}

			await cb(db, getNotesAndWarehouses);

			// Destroy the db after the test
			db.destroy();
		});
	};

	return {
		test
	};
};
// #endregion newModal

// #region test_data_transformers
const transformNote: TransformNote = ({ id, type, books }) => ({
	id,
	// Transform from "in-note" to "inbound"
	type: [type.split('-')[0], 'bound'].join('') as NoteType,
	books: books.map(transformBookStock).sort(sortByISBN)
});
const transformStock: TransformStock = (sn) => ({
	id: 'all-warehouses',
	books: sn.books.map(transformBookStock).sort(sortByISBN)
});
const mapWarehouses: MapWarehouses = (books) => {
	const warehousesObject = books.reduce((acc, b) => {
		const wName = b.warehouse;

		const warehouse = acc[wName] || ({ id: wName, books: [] } as TestStock);
		const entry = transformBookStock(b);

		return {
			...acc,
			[wName]: {
				...warehouse,
				books: [...warehouse.books, entry].sort(sortByISBN)
			}
		};
	}, {} as Record<string, TestStock>);

	return Object.values(warehousesObject);
};
// #endregion test_data_transformers

// #region helpers
const getISBN = (b: RawBookStock): string =>
	b.volumeInfo.industryIdentifiers.find(({ type }) => type === 'ISBN_10')?.identifier || '';
const transformBookStock = (b: RawBookStock): VolumeStock => ({
	isbn: getISBN(b),
	quantity: b.quantity
});
const sortByISBN = ({ isbn: i1 }: VolumeStock, { isbn: i2 }: VolumeStock) => (i1 < i2 ? -1 : 1);
// #endregion helpers
