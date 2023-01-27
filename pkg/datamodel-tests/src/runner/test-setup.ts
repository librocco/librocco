/* eslint-disable @typescript-eslint/no-empty-function */
import { test as t, bench as b } from 'vitest';
import PouchDB from 'pouchdb';

import { VolumeStock, NoteType, DatabaseInterface } from '@librocco/db';

import { __withDocker__ } from './env';

import {
	RawSnap,
	RawNote,
	GetNotesAndWarehouses,
	TestTask,
	TestStock,
	TransformNote,
	TransformStock,
	RawBookStock,
	MapWarehouses,
	ImplementationSetup
} from '@/types';

import { sortBooks } from '@/utils/misc';

// #region types
interface RawData {
	notes: RawNote[];
	snaps: RawSnap[];
}

// #endregion types

// #region newModal
export const newModel = (rawData: RawData, config: ImplementationSetup) => {
	const getNotesAndWarehouses: GetNotesAndWarehouses = (n: number) => {
		const notes = rawData.notes.slice(0, n).map(transformNote);

		const fullStockRaw = rawData.snaps[n - 1];
		const fullStock = transformStock(fullStockRaw);

		const warehouses = mapWarehouses(fullStockRaw.books);

		return { notes, fullStock, warehouses };
	};

	const taskSetup = async (): Promise<DatabaseInterface> => {
		// Get new db per test basis
		const pouchInstance = initDB();
		const db = config.newDatabase(pouchInstance);

		// Upload design documents if any
		const ddUpdates = config.designDocuments?.map((dd) => db.updateDesignDoc(dd));
		if (ddUpdates?.length) {
			await Promise.all(ddUpdates);
		}

		return db;
	};

	const test: TestTask = (name, cb) => {
		t(
			name,
			async () => {
				const db = await taskSetup();
				await cb(db, getNotesAndWarehouses);
			},
			10000
		);
	};

	const bench: TestTask = (name, cb) => {
		b(name, async () => {
			const db = await taskSetup();
			await cb(db, getNotesAndWarehouses);
		});
	};

	return {
		test,
		bench
	};
};
// #endregion newModal

/**
 * @TODO these should be hard coded in the data (already transformed)
 * when we agree on the input data
 */
// #region test_data_transformers
const transformNote: TransformNote = ({ id, type, books }) => ({
	id,
	// Transform from "in-note" to "inbound"
	type: [type.split('-')[0], 'bound'].join('') as NoteType,
	books: books.map(transformBookStock).sort(sortBooks)
});
const transformStock: TransformStock = (sn) => ({
	id: 'all-warehouses',
	books: sn.books
		.map(transformBookStock)
		// Filter books with no quantity
		.filter(({ quantity }) => Boolean(quantity))
		.sort(sortBooks)
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
				books: [...warehouse.books, entry].sort(sortBooks)
			}
		};
	}, {} as Record<string, TestStock>);

	return Object.values(warehousesObject);
};
// #endregion test_data_transformers

// #region helpers
const getISBN = (b: RawBookStock): string => b.volumeInfo.industryIdentifiers.find(({ type }) => type === 'ISBN_10')?.identifier || '';
const transformBookStock = (b: RawBookStock): VolumeStock & { warehouse: string } => ({
	isbn: getISBN(b),
	quantity: b.quantity,
	warehouse: b.warehouse
});
// #endregion helpers

// #region env
const initDB = (): PouchDB.Database => {
	const dbName = new Date().toISOString().replaceAll(/[.:]/g, '-').toLowerCase();
	const fullName = __withDocker__ ? ['http://admin:admin@127.0.0.1:5001', `test-${dbName}`].join('/') : dbName;
	const options = __withDocker__ ? {} : { adapter: 'memory' };

	return new PouchDB(fullName, options);
};
// #endregion env
