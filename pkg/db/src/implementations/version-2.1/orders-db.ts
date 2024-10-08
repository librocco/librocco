/* eslint-disable @typescript-eslint/no-explicit-any */
import { BehaviorSubject, combineLatest, filter, firstValueFrom, map, tap } from "rxjs";
import { Kysely, sql } from "kysely";

import { asc, wrapIter, debug, StockMap, VolumeStockInput } from "@librocco/shared";

import {
	Replicator,
	WarehouseDataMap,
	NoteInterface,
	NoteLookupResult,
	PluginInterfaceLookup,
	LibroccoPlugin,
	OrdersDatabaseConstructor,
	BooksInterface,
	DbStream,
	HistoryInterface,
	DBConfigOpts,
	LogLevel
} from "@/types";
import { DatabaseSchema, OrdersDatabaseInterface, Selectable, SelectedStream, WarehouseInterface } from "./types";

import { NEW_WAREHOUSE } from "@/constants";

import database from "./database";

import { newPluginsInterface } from "./plugins";
import { createWarehouseInterface } from "./warehouse";
import { createBooksInterface } from "./books";

import { createHistoryInterface } from "./history";

class Database implements OrdersDatabaseInterface {
	#db: ReturnType<typeof database>;
	#ready = new BehaviorSubject(false);
	#logLevel: LogLevel;

	_sql: ReturnType<typeof database>["sql"];

	private _plugins = newPluginsInterface();

	constructor(name: string, opts?: DBConfigOpts) {
		this.#db = database(name, opts);
		this.#logLevel = opts.logLevel;
		this._sql = this.#db.sql;
	}

	async init(ctx: debug.DebugCtx = {}): Promise<OrdersDatabaseInterface> {
		debug.log(ctx, "[db init] in progress...")("");
		await this.#db.init(ctx);
		debug.log(ctx, "[db init] initialised the core db!")("");
		this.#ready.next(true);
		debug.log(ctx, "[db init] db ready!")("");
	}
}

export const newDatabase: OrdersDatabaseConstructor = (_name = "dev", opts?: DBConfigOpts) => {
	// If testing, we're namespacing the db as SQLite writes to fs, so it's easy to write to the designated folder,
	// and then, clean up and / or ignore the folder
	let name = opts.test ? `test-dbs/${_name}` : _name;
	name = name.endsWith(".sqlite3") ? name : name + ".sqlite3";

	return new Database(name, opts);
};
