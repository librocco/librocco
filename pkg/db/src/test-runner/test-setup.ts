/* eslint-disable @typescript-eslint/no-empty-function */
import { test as t, bench as b } from "vitest";
import PouchDB from "pouchdb";

import { __withDocker__ } from "./env";

import { DatabaseInterface } from "@/types";
import { RawSnap, RawNote, GetNotesAndWarehouses, TestTask, TestStock, MapWarehouses, ImplementationSetup } from "./types";

import { sortBooks } from "@/utils/misc";

// #region types
interface RawData {
	notes: RawNote[];
	snaps: RawSnap[];
}
// #endregion types

export const newModel = (rawData: RawData, config: ImplementationSetup) => {
	const getNotesAndWarehouses: GetNotesAndWarehouses = (n) => {
		const notes = rawData.notes.slice(0, n);

		const fullStock = rawData.snaps[n - 1];

		const warehouses = mapWarehouses(fullStock.books);

		return { notes, fullStock, warehouses };
	};

	const taskSetup = async (): Promise<DatabaseInterface> => {
		// Get new db per test basis
		const dbName = new Date().toISOString().replaceAll(/[.:]/g, "-").toLowerCase();
		const pouchInstance = new PouchDB(dbName, { adapter: "memory" });

		const db = config.newDatabase(pouchInstance).init();

		// If testing with docker support, we're using the remote db to replicate to/from
		if (__withDocker__) db.replicate().from(["http://admin:admin@127.0.0.1:5001", `test-${dbName}`].join("/"), {});

		return db;
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

const mapWarehouses: MapWarehouses = (books) => {
	const warehousesObject = books.reduce((acc, b) => {
		const { warehouseId } = b;
		const warehouse = acc[warehouseId] || ({ id: warehouseId, books: [] } as TestStock);

		return {
			...acc,
			[warehouseId]: {
				...warehouse,
				books: [...warehouse.books, b].sort(sortBooks)
			}
		};
	}, {} as Record<string, TestStock>);

	return Object.values(warehousesObject);
};
