/* eslint-disable @typescript-eslint/no-explicit-any */
import { BehaviorSubject, combineLatest, filter, firstValueFrom, map, of, tap } from "rxjs";
import { Kysely } from "kysely";

import { asc, wrapIter, debug } from "@librocco/shared";

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
import { DatabaseSchema, InventoryDatabaseInterface, Selectable, SelectedStream, WarehouseInterface } from "./types";

import { NEW_WAREHOUSE } from "@/constants";

import database from "./database";

import { newPluginsInterface } from "./plugins";
import { createWarehouseInterface } from "./warehouse";
import { createBooksInterface } from "./books";

import { createHistoryInterface } from "./history";

class Database implements InventoryDatabaseInterface {
	#db: ReturnType<typeof database>;
	#ready = new BehaviorSubject(false);
	_sql: ReturnType<typeof database>["sql"];

	private _plugins = newPluginsInterface();

	constructor(name: string) {
		this.#db = database(name);
		this._sql = this.#db.sql;
	}

	async _connection() {
		await firstValueFrom(this.#ready.pipe(filter(Boolean)));
		return this.#db;
	}
	_stream<S extends Selectable<any>>(qb: (db: Kysely<DatabaseSchema>) => S, idPrefix?: string): SelectedStream<S> {
		return this.#db.stream(qb, idPrefix);
	}

	async _update(cb: (db: Kysely<DatabaseSchema>) => Promise<any>): Promise<void> {
		await cb(await this._connection());
	}

	books(): BooksInterface {
		return createBooksInterface(this);
	}

	warehouse(id?: string | typeof NEW_WAREHOUSE) {
		return createWarehouseInterface(this, id);
	}

	async init(ctx: debug.DebugCtx = {}): Promise<InventoryDatabaseInterface> {
		debug.log(ctx, "[db init] in progress...")("");
		await this.#db.init(ctx);
		debug.log(ctx, "[db init] initialised the core db!")("");
		this.#ready.next(true);
		debug.log(ctx, "[db init] db ready!")("");

		debug.log(ctx, "[db init] creating initiali wh...")("");
		await this.warehouse().create(ctx);
		debug.log(ctx, "[db init] done!")("");
		return;
	}

	// TODO
	destroy() {
		return Promise.resolve();
	}

	async findNote(noteId: string): Promise<NoteLookupResult<NoteInterface, WarehouseInterface> | undefined> {
		const res = await this._connection().then((conn) =>
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
		return createHistoryInterface(this);
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
			warehouseMap: (ctx: debug.DebugCtx) =>
				this._stream((db) => db.selectFrom("warehouses").select(["id", "displayName", "updatedAt", "discountPercentage"])).pipe(
					// Add a default "all" (pseudo) warehouse
					map((rows) => rows || []),
					tap(debug.log(ctx, "warehouse_map:got_res_from_db")),
					map((rows) => [{ id: "all", displayName: "All", discountPercentage: 0 }, ...rows]),
					map((rows) => rows.sort(asc(({ id }) => id))),
					tap(debug.log(ctx, "warehouse_map:sorted")),
					map((rows) => new Map(rows.map((r) => [r.id, r])))
				),

			// TODO: this should really be changed since we only care about notes (not warehouses without open notes)
			inNoteList: () => {
				const warehouses = this.stream().warehouseMap({});

				const inNotes = this._stream((db) =>
					db
						.selectFrom("notes as n")
						.where("n.committed", "!=", 1)
						// TODO: this should also probably be removed (delete should delete)
						.where("n.deleted", "!=", 1)
						.where("n.noteType", "==", "inbound")
						.select(["id", "warehouseId", "displayName"])
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
				this._stream((db) =>
					db
						.selectFrom("notes")
						.where("committed", "is not", 1)
						.where("noteType", "==", "outbound")
						.where("deleted", "is not", 1)
						.select(["id", "displayName", "updatedAt"])
				).pipe(map((rows) => new Map(rows.map((r) => [r.id, r])))),

			// TODO: might not be necessary as part of public API
			stock: () => of(new Map() as any)
		} as DbStream;
	}
}

export const newDatabase: InventoryDatabaseConstructor = (_name = "dev", { test = false } = {}) => {
	// If testing, we're namespacing the db as SQLite writes to fs, so it's easy to write to the designated folder,
	// and then, clean up and / or ignore the folder
	let name = test ? `test-dbs/${_name}` : _name;
	name = name.endsWith(".sqlite3") ? name : name + ".sqlite3";

	return new Database(name);
};
