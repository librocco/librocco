/* eslint-disable @typescript-eslint/no-explicit-any */
import { BehaviorSubject } from "rxjs";

import { debug } from "@librocco/shared";

import { OrdersDatabaseConstructor, DBConfigOpts, LogLevel } from "@/types";
import { OrdersDatabaseInterface, CustomerOrderInterface } from "./types";

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

	/**
	 * Instantiate a new customer order instance, with the provided id.
	1. db.customerOrder()
	2. db.customerOrder(1)
	3. db.customerOrder(1).create()
	 */
	customerOrder(id?: number): CustomerOrderInterface {
		return new CustomerOrder(this, id);
	}
	// #endregion instances
}

export const newDatabase: OrdersDatabaseInterface = (_name = "dev", opts?: DBConfigOpts) => {
	// If testing, we're namespacing the db as SQLite writes to fs, so it's easy to write to the designated folder,
	// and then, clean up and / or ignore the folder
	let name = opts.test ? `test-dbs/${_name}` : _name;
	name = name.endsWith(".sqlite3") ? name : name + ".sqlite3";

	return new Database(name, opts);
};

class CustomerOrder implements CustomerOrderInterface {
	#db: OrdersDatabaseInterface;

	id: number;

	constructor(db: OrdersDatabaseInterface, id: number) {
		this.#db = db;
		this.id = id;
	}

	get() {
		return;
	}

	async create(ctx: debug.DebugCtx = {}): Promise<CustomerOrderInterface> {
		const values = { id: this.id };
		await this.#db._update((db) =>
			db
				.insertInto("warehouses")
				.values(values)
				.onConflict((oc) => oc.doNothing())
				.execute()
		);
		debug.log(ctx, "[WAREHOUSE:create] done!")("");

		return this.get();
	}
}
