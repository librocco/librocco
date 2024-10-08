/* eslint-disable @typescript-eslint/no-explicit-any */
import { BehaviorSubject } from "rxjs";

import { debug } from "@librocco/shared";

import {
	OrdersDatabaseConstructor,
	DBConfigOpts,
	LogLevel
} from "@/types";
import { OrdersDatabaseInterface } from "./types";


import database from "./database";

import { newPluginsInterface } from "./plugins";


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
