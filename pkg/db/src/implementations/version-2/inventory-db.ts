/* eslint-disable @typescript-eslint/no-explicit-any */
import { combineLatest, map, of } from "rxjs";
import { Schema } from "crstore";
import { database, SvelteDatabase } from "crstore/svelte";

import { asc, wrapIter } from "@librocco/shared";

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
import { observableFromStore } from "@/helpers";

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

	async init(): Promise<InventoryDatabaseInterface> {
		await this.warehouse().create();
		return;
	}

	// TODO
	destroy() {
		return Promise.resolve();
	}

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

	// TODO: might not be necessary as part of public API
	getWarehouseDataMap(): Promise<WarehouseDataMap> {
		return Promise.resolve(new Map());
	}

	// TODO
	history(): HistoryInterface {
		return {} as HistoryInterface;
	}

	plugin<T extends keyof PluginInterfaceLookup>(type: T): LibroccoPlugin<PluginInterfaceLookup[T]> {
		return this._plugins.get(type);
	}

	// TODO
	replicate(): Replicator {
		return {} as Replicator;
	}

	// TODO
	stream() {
		return {
			warehouseMap: () =>
				observableFromStore(
					this._db.replicated((db) => db.selectFrom("warehouses").select(["id", "displayName", "updatedAt", "discountPercentage"]))
				).pipe(
					// Add a default "all" (pseudo) warehouse
					map((rows) => [{ id: "all", displayName: "All", discountPercentage: 0 }, ...rows]),
					map((rows) => rows.sort(asc(({ id }) => id))),
					map((rows) => new Map(rows.map((r) => [r.id, r])))
				),

			// TODO: this should really be changed since we only care about notes (not warehouses without open notes)
			inNoteList: () => {
				const warehouses = this.stream().warehouseMap({});

				const inNotes = observableFromStore(
					this._db.replicated((db) =>
						db
							.selectFrom("notes as n")
							.where("n.committed", "!=", 1)
							// TODO: this should also probably be removed (delete should delete)
							.where("n.deleted", "!=", 1)
							.where("n.noteType", "==", "inbound")
							.select(["id", "warehouseId", "displayName"])
					)
				).pipe(
					map((notes) =>
						wrapIter(notes)
							._group(({ warehouseId, id, displayName }) => [warehouseId, [id, { displayName }] as const])
							.map(([id, notes]) => [id, new Map(notes)] as const)
					),
					map((n) => new Map(n))
				);

				return combineLatest([warehouses, inNotes]).pipe(
					map(([warehouses, inNotes]) =>
						wrapIter(warehouses).map(
							([id, { displayName }]) =>
								[
									id,
									{
										displayName,
										notes: id === "all" ? new Map(wrapIter(inNotes).flatMap(([, notes]) => notes)) : inNotes.get(id) || new Map()
									}
								] as const
						)
					),
					map((rows) => new Map(rows))
				);
			},

			outNoteList: () =>
				observableFromStore(
					this._db.replicated((db) =>
						db
							.selectFrom("notes")
							.where("committed", "is not", 1)
							.where("noteType", "==", "outbound")
							.where("deleted", "is not", 1)
							.select(["id", "displayName", "updatedAt"])
					)
				).pipe(map((rows) => new Map(rows.map((r) => [r.id, r])))),

			// TODO: might not be necessary as part of public API
			stock: () => of(new Map() as any)
		} as DbStream;
	}
}

export const newDatabase: InventoryDatabaseConstructor = (_name, { test = false } = {}) => {
	// If testing, we're namespacing the db as SQLite writes to fs, so it's easy to write to the designated folder,
	// and then, clean up and / or ignore the folder
	const name = test ? `test-dbs/${_name}` : _name;
	return new Database(name);
};
