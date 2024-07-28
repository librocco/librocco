/* eslint-disable @typescript-eslint/no-explicit-any */
import { Schema } from "crstore";
import { database, SvelteDatabase } from "crstore/svelte";

import {
	Replicator,
	WarehouseDataMap,
	NoteInterface,
	NoteLookupResult,
	PluginInterfaceLookup,
	LibroccoPlugin,
	InventoryDatabaseConstructor,
	BooksInterface,
	DbStream,
	HistoryInterface
} from "@/types";
import { InventoryDatabaseInterface, WarehouseInterface, DatabaseSchema } from "./types";

import { NEW_WAREHOUSE } from "@/constants";

import { schema } from "./schema";

import { newPluginsInterface } from "./plugins";
import { createWarehouseInterface } from "./warehouse";

class Database implements InventoryDatabaseInterface {
	_db: SvelteDatabase<Schema<DatabaseSchema>>;

	private _plugins = newPluginsInterface();

	constructor(name: string) {
		this._db = database(schema, { name });
	}

	// TODO
	books(): BooksInterface {
		return {} as BooksInterface;
	}

	warehouse(id?: string | typeof NEW_WAREHOUSE) {
		return createWarehouseInterface(this, id);
	}

	// TODO
	stream() {
		return {} as DbStream;
	}

	// TODO
	async init(): Promise<InventoryDatabaseInterface> {
		return Promise.resolve(this);
	}

	// TODO
	destroy() {
		return Promise.resolve();
	}

	// TODO
	async findNote(noteId: string): Promise<NoteLookupResult<NoteInterface, WarehouseInterface> | undefined> {
		const res = await this._db.connection.then((conn) =>
			conn
				.selectFrom("notes as n")
				.leftJoin("warehouses as w", "n.warehouseId", "w.id")
				.select("w.id as warehouseId")
				.select("n.id as noteId")
				.where("n.id", "==", noteId)
				.executeTakeFirst()
		);

		if (!res) return undefined;

		const [warehouse, note] = await Promise.all([
			this.warehouse(res.warehouseId).get(),
			this.warehouse(res.warehouseId).note(res.noteId).get()
		]);
		return { warehouse, note };
	}

	// TODO
	getWarehouseDataMap(): Promise<WarehouseDataMap> {
		return Promise.resolve(new Map());
	}

	// TODO
	history(): HistoryInterface {
		return {} as HistoryInterface;
	}

	// TODO
	plugin<T extends keyof PluginInterfaceLookup>(type: T): LibroccoPlugin<PluginInterfaceLookup[T]> {
		return this._plugins.get(type);
	}

	// TODO
	replicate(): Replicator {
		return {} as Replicator;
	}
}

export const newDatabase: InventoryDatabaseConstructor = (_name, { test = false } = {}) => {
	// If testing, we're namespacing the db as SQLite writes to fs, so it's easy to write to the designated folder,
	// and then, clean up and / or ignore the folder
	const name = test ? `test-dbs/${_name}` : _name;
	return new Database(name);
};
