/* eslint-disable @typescript-eslint/no-empty-function */
import { test as t, bench as b } from "vitest";
import PouchDB from "pouchdb";

import { __withDocker__ } from "./env";

import { NoteType, DatabaseInterface, VersionString, VolumeStockClient } from "@/types";
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
} from "./types";

import { sortBooks } from "@/utils/misc";

// #region types
interface RawData {
	notes: RawNote[];
	snaps: RawSnap[];
}
// #endregion types

// #region newModal
export const newModel = (rawData: RawData, config: ImplementationSetup) => {
	const getNotesAndWarehouses: GetNotesAndWarehouses = (version) => (n) => {
		const notes = rawData.notes.slice(0, n).map(transformNote(version));

		const fullStockRaw = rawData.snaps[n - 1];
		const fullStock = transformStock(version)(fullStockRaw);

		const warehouses = mapWarehouses(version)(fullStockRaw.books);

		return { notes, fullStock, warehouses };
	};

	const taskSetup = async (): Promise<DatabaseInterface> => {
		// Get new db per test basis
		const dbName = new Date().toISOString().replaceAll(/[.:]/g, "-").toLowerCase();
		const pouchInstance = new PouchDB(dbName, { adapter: "memory" });

		const db = config.newDatabase(pouchInstance);

		// If testing with docker support, we're using the remote db to replicate to/from
		const remoteDb = __withDocker__ ? ["http://admin:admin@127.0.0.1:5001", `test-${dbName}`].join("/") : undefined;

		return db.init({}, { remoteDb });
	};

	const test: TestTask = (name, cb) => {
		t(
			name,
			async () => {
				const db = await taskSetup();
				await cb(db, config.version, getNotesAndWarehouses);
			},
			10000
		);
	};

	const bench: TestTask = (name, cb) => {
		b(name, async () => {
			const db = await taskSetup();
			await cb(db, config.version, getNotesAndWarehouses);
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

const transformNote: TransformNote =
	(version) =>
	({ id, type, books }) => ({
		id: `${version}/${id}`,
		// Transform from "in-note" to "inbound"
		type: [type.split("-")[0], "bound"].join("") as NoteType,
		books: books.map(transformBookStock(version)).sort(sortBooks)
	});

const transformStock: TransformStock = (version) => (sn) => ({
	id: `all-warehouses`,
	books: sn.books
		.map(transformBookStock(version))
		// Filter books with no quantity
		.filter(({ quantity }) => Boolean(quantity))
		.sort(sortBooks)
});

const mapWarehouses: MapWarehouses = (version) => (books) => {
	const warehousesObject = books.reduce((acc, b) => {
		const wName = `${version}/${b.warehouseId}`;

		const warehouse = acc[wName] || ({ id: wName, books: [] } as TestStock);
		const entry = transformBookStock(version)(b);

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

const getISBN = (b: RawBookStock): string => b.volumeInfo.industryIdentifiers.find(({ type }) => type === "ISBN_10")?.identifier || "";

const transformBookStock =
	(version: VersionString) =>
	(b: RawBookStock): VolumeStockClient => ({
		isbn: getISBN(b),
		quantity: b.quantity,
		warehouseId: `${version}/${b.warehouseId}`,
		// When the warehouse is created, the name is the same as the id.
		// Since this test is used to check the stock aggregation after multiple notes,
		// we're not bothering with assigning custom 'diplayName' to the warehouses.
		warehouseName: `${version}/${b.warehouseId}`
	});
// #endregion helpers
