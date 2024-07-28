/* eslint-disable @typescript-eslint/no-explicit-any */
import { firstValueFrom, map, Observable, of } from "rxjs";
import { groupJSON } from "crstore";
import { database } from "crstore/svelte";
import { get } from "svelte/store";

import { StockMap } from "@librocco/shared";

import {
	Replicator,
	WarehouseDataMap,
	NoteInterface,
	NoteLookupResult,
	PluginInterfaceLookup,
	LibroccoPlugin,
	InventoryDatabaseConstructor
} from "@/types";
import { InventoryDatabaseInterface, WarehouseInterface, DatabaseSchema } from "./types";

import { NEW_WAREHOUSE } from "@/constants";

import { schema } from "./schema";

import { newPluginsInterface } from "./plugins";
import { createNoteInterface } from "./note";
import { createWarehouseInterface } from "./warehouse";
import { createBooksInterface } from "./books";
import { createHistoryInterface } from "./history";

import { observableFromStore } from "@/helpers";

export const createDB = (schema: DatabaseSchema, name: string): InventoryDatabaseInterface => {
	const db = database(schema, { name });

	const warehouses = () => db.replicated((db) => db.selectFrom("warehouses").selectAll());
	const warehouseMap = (): Observable<WarehouseDataMap> =>
		observableFromStore(warehouses()).pipe(
			map((whs) => new Map(whs.map(({ id, displayName, discountPercentage }) => [id, { displayName, discountPercentage }])))
		);

	const inNotes = () =>
		db.replicated((db) =>
			db
				.selectFrom("warehouses as w")
				.rightJoin("notes as n", "w.id", "n.warehouseId")
				.where("n.noteType", "==", "inbound")
				.where("n.committed", "==", false)
				.select([
					"w.id",
					"w.displayName",
					(gq) =>
						groupJSON(gq, {
							id: "n.id",
							displayName: "n.displayName",
							updatedAt: "n.updatedAt"
						}).as("notes")
				])
				.groupBy("w.id")
		);
	const inNoteList = () =>
		observableFromStore(inNotes()).pipe(
			map(
				(entries) =>
					new Map(
						entries.map(({ id, displayName, notes }) => [
							id!,
							{ id: id!, displayName: displayName!, notes: new Map(notes.map(({ id, displayName }) => [id!, { id, displayName }])) }
						])
					)
			)
		);

	const outNotes = () =>
		db.replicated((db) => db.selectFrom("notes").where("noteType", "==", "outbound").where("committed", "==", false).selectAll());
	const outNoteList = () =>
		observableFromStore(outNotes()).pipe(map((notes) => new Map(notes.map(({ id, displayName }) => [id, { id, displayName }]))));

	// TODO: this should be unnecessary
	const stock = () => of(new StockMap());

	const findNote = (id: string): NoteLookupResult<NoteInterface, WarehouseInterface> | undefined => {
		const note = get(db.replicated((db) => db.selectFrom("notes").where("id", "==", id).select(["warehouseId"])))[0];
		if (!note) return undefined;
		return {
			note: createNoteInterface(createDB(schema, name), note.warehouseId, id),
			warehouse: createWarehouseInterface(createDB(schema, name), note.warehouseId)
		};
	};

	const plugins = newPluginsInterface();

	return Object.assign(db, {
		books() {
			return createBooksInterface(createDB(schema, name));
		},
		warehouse(id?: string | typeof NEW_WAREHOUSE) {
			return createWarehouseInterface(createDB(schema, name), id);
		},

		stream() {
			return { warehouseMap, inNoteList, outNoteList, stock };
		},

		async init() {
			return createDB(schema, name);
		},

		destroy() {
			// TODO
			return Promise.resolve();
		},

		findNote(id: string) {
			return Promise.resolve(findNote(id));
		},

		getWarehouseDataMap() {
			return firstValueFrom(warehouseMap());
		},

		history() {
			return createHistoryInterface(createDB(schema, name));
		},

		plugin<T extends keyof PluginInterfaceLookup>(type: T): LibroccoPlugin<PluginInterfaceLookup[T]> {
			return plugins.get(type);
		},

		// TODO
		replicate() {
			return {} as Replicator;
		}
	});
};

export const newDatabase: InventoryDatabaseConstructor = (_name, { test = false } = {}) => {
	// If testing, we're namespacing the db as SQLite writes to fs, so it's easy to write to the designated folder,
	// and then, clean up and / or ignore the folder
	const name = test ? `test-dbs/${_name}` : _name;
	return createDB(schema, name);
};
