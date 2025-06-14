import { cryb64 } from "@vlcn.io/ws-common";

import { zip } from "@librocco/shared";

import type { DB } from "../types";
import { getDB } from "../db";

function firstPick<T>(data: any[]): T | undefined {
	const d = data[0];
	if (d == null) {
		return undefined;
	}

	return d[Object.keys(d)[0]];
}

interface LogDone {
	(): void;
	<R>(res: R): R;
}
type Logger = {
	log: (...params: any[]) => void;
	debug: (...params: any[]) => void;
	extend: (prefix: string) => Logger;
	start: (params?: Record<string, any>) => void;
	done: LogDone;
};

const newLogger = (prefixes: string[] = []): Logger => {
	const prefix = prefixes.map((x) => `[${x}]`).join("");

	const log = (...params: any[]) => {
		if (window["LOG_LEVEL"] < 1) return;
		if (prefix) return console.log("[log]", prefix, ...params);
		console.log("[log]", ...params);
	};

	const debug = (...params: any[]) => {
		if (window["LOG_LEVEL"] < 2) return;
		if (prefix) return console.log("[debug]", prefix, ...params);
		console.log("[debug]", ...params);
	};

	const extend = (prefix: string) => {
		return newLogger([...prefixes, prefix]);
	};

	const start = (params?: Record<string, any>) => {
		log("started!");

		debug("params:");
		for (const [key, value] of Object.entries(params || {})) {
			debug(`${key}:`, value);
		}
	};

	const done = <R>(res: R) => {
		log("done!");

		debug("result:");
		debug(res);

		return res;
	};

	return { log, debug, extend, start, done: done as LogDone };
};
const logger = newLogger();

/**
 * A copy of crsqlite db.automigrateTo function,
 * @see https://github.com/vlcn-io/js/blob/b1574592f87067c8d6ddc269d9ad26018cfde05b/packages/crsqlite-wasm/src/DB.ts#L74
 * only this is used to test out autmigration in JS context (for easier error reporting/debugging) and, as such, it uses the
 * JS code defined below instead of calling the `crsql_automigrate` SQL function.
 *
 * The JS code used below is a port of the Rust code integrated into the crsqlite extension.
 *
 * IMPORTANT NOTE: This is for debug purposes only and should NEVER be used in production as (unlike the original) it doesn't wrap everything into a transaction
 */
export async function jsAutomigrateTo(db: DB, schemaName: string, schemaContent: string): Promise<"noop" | "apply" | "migrate"> {
	const l = logger.extend("jsAutomigrateTo");
	l.start({ db, schemaName, schemaContent });

	// less safety checks for local db than server db.
	const version = cryb64(schemaContent);
	const storedName = firstPick(await db.execA(`SELECT value FROM crsql_master WHERE key = 'schema_name'`));
	const storedVersion = firstPick(await db.execA(`SELECT value FROM crsql_master WHERE key = 'schema_version'`)) as
		| bigint
		| number
		| undefined;

	if (storedName === schemaName && BigInt(storedVersion || 0) === version) {
		return "noop";
	}

	const ret = storedName === undefined || storedName !== schemaName ? "apply" : "migrate";

	// IMPORTANT NOTE: the following would have been a transaction, but, while that may work with internally defined crsqlite_migrate,
	// we can't use it as we need access to different DBs internally and that would cause deadlocks
	if (storedVersion == null || storedName !== schemaName) {
		if (storedName !== schemaName) {
			// drop all tables since a schema name change is a reformat of the db.
			const tables = await db.execA(
				`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'crsql_%'`
			);
			for (const table of tables) {
				await db.exec(`DROP TABLE [${table[0]}]`);
			}
		}
		await db.exec(schemaContent);
	} else {
		// The following line is the original (for the original method):
		//
		// await db.exec(`SELECT crsql_automigrate(?, 'SELECT crsql_finalize();')`, [schemaContent]);
		//
		// it calls the crsql_automigrate function, the impl for which can be found at:
		// https://github.com/vlcn-io/cr-sqlite/blob/891fe9e0190dd20917f807d739c809e1bc32f6a3/core/rs/core/src/automigrate.rs#L31
		//
		// Here we're using the JS version of the same code in order to have clear and granunlar control on the execution
		await crsql_automigrate(db, schemaContent, `SELECT crsql_finalize()`);
	}
	await db.exec(`INSERT OR REPLACE INTO crsql_master (key, value) VALUES (?, ?)`, ["schema_version", version]);
	await db.exec(`INSERT OR REPLACE INTO crsql_master (key, value) VALUES (?, ?)`, ["schema_name", schemaName]);

	await db.exec(`VACUUM;`);

	return l.done(ret);
}

/**
 * @see https://github.com/vlcn-io/cr-sqlite/blob/891fe9e0190dd20917f807d739c809e1bc32f6a3/core/rs/core/src/automigrate.rs#L31
 */
export async function crsql_automigrate(db: DB, schema: string, cleanup_stmt: string): Promise<void> {
	const l = logger.extend("crsql_automigrate");
	l.start({ db, schema, cleanup_stmt });

	// NOTE: the original Rust code parses the args received as pointers from the C glue and then proceeds to call the
	// automigrate_impl function with the parsed args. Here we're letting TS take care of that and are calling the impl
	// right away (rendering this function unnecessary, but defined here to keep consistent with the original code structure.
	await automigrate_impl(db, schema, cleanup_stmt);
	console.log("Automigration completed successfully!");

	return l.done();
}

/**
 * @see https://github.com/vlcn-io/cr-sqlite/blob/891fe9e0190dd20917f807d739c809e1bc32f6a3/core/rs/core/src/automigrate.rs#L55
 */
export async function automigrate_impl(db: DB, schema: string, cleanup_stmt: string) {
	const l = logger.extend("automigrate_impl");
	l.start({ db, schema, cleanup_stmt });

	const cleanup = (mem_db: DB) => mem_db.exec(cleanup_stmt);

	const local_db = db;
	const desired_schema = schema;
	const stripped_schema = strip_crr_statements(desired_schema);

	l.debug("initialising db");
	const mem_db = await getDB(":memory:");
	if (!mem_db) {
		throw new Error("could not open the temporary migration db");
	}
	l.debug("got db");

	try {
		l.debug("applying schema");
		await mem_db.exec(stripped_schema);
	} catch (e) {
		// NOTE: we won't get as good of an error as we would within
		// the sqlite extension (Rust code), but we get a clearer idea on the point of failure
		console.error(e);
		await cleanup(mem_db);
		throw e;
	}

	l.debug("schema applied, starting migration");
	await local_db.exec("SAVEPOINT automigrate_tables;");

	try {
		await migrate_to(local_db, mem_db);
		await cleanup(mem_db);
	} catch (e) {
		local_db.exec("ROLLBACK");
		// NOTE: we won't get as good of an error as we would within
		// the sqlite extension (Rust code), but we get a clearer idea on the point of failure
		console.error(e);
		await cleanup(mem_db);
		throw e;
	}

	// IDK Why this is needed here (seems as if it would most certainly break -- unique constraint violations and what not...)
	// EDIT: this is here as no new tables/indices are added within the check -- only the stale/existing ones are removed/updated
	// and the full schema is applied at the end (here), skipping the existing ones and merely creating the new ones
	//
	// IMPORTANT NOTE: This implies that 'CREATE TABLE <table>' statements (or their index counterparts) will fail due to UNIQUE constraint violations
	// and all such statements shold be replaced with 'CREATE TABLE IF NOT EXISTS <table>' statements (or their index counterparts)
	if (desired_schema.length) {
		local_db.exec(desired_schema);
	}

	await local_db.exec("RELEASE automigrate_tables");

	return l.done();
}

/**
 * @see https://github.com/vlcn-io/cr-sqlite/blob/891fe9e0190dd20917f807d739c809e1bc32f6a3/core/rs/core/src/automigrate.rs#L106
 */
export async function migrate_to(local_db: DB, mem_db: DB) {
	const l = logger.extend("migrate_to");
	l.start({ local_db, mem_db });

	const sql = `SELECT name FROM sqlite_master WHERE type = 'table'
	    AND name NOT LIKE 'sqlite_%'
	    AND name NOT LIKE 'crsql_%'
	    AND name NOT LIKE '__crsql_%'
	    AND name NOT LIKE '%__crsql_%'`;
	const mem_tables = await mem_db.execA<[string]>(sql).then((r) => new Set(r.map(([name]) => name)));
	const local_tables = await local_db.execA<[string]>(sql).then((r) => new Set(r.map(([name]) => name)));

	const removed_tables: Array<string> = [];
	const maybe_modified_tables: Array<string> = [];

	for (const table of local_tables) {
		if (mem_tables.has(table)) {
			maybe_modified_tables.push(table);
		} else {
			removed_tables.push(table);
		}
	}

	await drop_tables(local_db, removed_tables);
	for (const table of maybe_modified_tables) {
		await maybe_modify_table(local_db, table, mem_db);
	}

	return l.done();
}

/**
 * stripts `select crsql_as_crr` statements
 * from the provided schema.
 * returns which tables were crrs so we can re-apply the statements
 * once migrations are complete.
 *
 * We have to strip the statements given we can't load an extension into an extension
 * in all environment.
 *
 * E.g., if cr-sqlite is running as a runtime loadable ext
 * then it cannot open an in-memory db within itself that loads this same
 * extension.
 *
 * @see https://github.com/vlcn-io/cr-sqlite/blob/891fe9e0190dd20917f807d739c809e1bc32f6a3/core/rs/core/src/automigrate.rs#L158
 */
export function strip_crr_statements(schema: string) {
	return schema
		.split("\n")
		.filter((line) => !line.toLowerCase().includes("crsql_as_crr") && !line.toLowerCase().includes("crsql_fract_as_ordered"))
		.join("\n");
}

/**
 * @see https://github.com/vlcn-io/cr-sqlite/blob/891fe9e0190dd20917f807d739c809e1bc32f6a3/core/rs/core/src/automigrate.rs#L169
 */
export async function drop_tables(local_db: DB, tables: string[]) {
	const l = logger.extend("drop_tables");
	l.start({ local_db, tables });

	for (const table of tables) {
		await local_db.exec(`DROP TABLE ?`, [table]);
	}

	return l.done();
}

/**
 * @see https://github.com/vlcn-io/cr-sqlite/blob/891fe9e0190dd20917f807d739c809e1bc32f6a3/core/rs/core/src/automigrate.rs#L181
 */
export async function maybe_modify_table(local_db: DB, table: string, mem_db: DB) {
	const l = logger.extend("maybe_modify_table");
	l.start({ local_db, table, mem_db });

	const sql = "SELECT name FROM pragma_table_info(?)";
	const mem_columns = await mem_db.execA<[string]>(sql).then(([columns]) => new Set(columns || []));
	const local_columns = await local_db.execA<[string]>(sql).then(([columns]) => new Set(columns || []));

	const removed_columns: Array<string> = [];
	const added_columns: Array<string> = [];

	for (const column of local_columns) {
		if (!mem_columns.has(column)) {
			removed_columns.push(column);
		}
	}

	for (const column of mem_columns) {
		if (!local_columns.has(column)) {
			added_columns.push(column);
		}
	}

	const is_a_crr = await is_crr(local_db, table);
	if (is_a_crr) {
		await local_db.exec("SELECT crsql_begin_alter(?)", [table]);
	}

	await drop_columns(local_db, table, removed_columns);
	await add_columns(local_db, table, added_columns, mem_db);
	await maybe_update_indices(local_db, table, mem_db);

	if (is_a_crr) {
		await local_db.exec("SELECT crsql_commit_alter(?)", [table]);
	}

	return l.done();
}

/**
 * @see https://github.com/vlcn-io/cr-sqlite/blob/891fe9e0190dd20917f807d739c809e1bc32f6a3/core/rs/core/src/is_crr.rs#L10
 */
export async function is_crr(local_db: DB, table: string) {
	const l = logger.extend("is_crr");
	l.start({ local_db, table });

	const sql = "SELECT count(*) FROM sqlite_master WHERE type = 'trigger' AND name = ?";
	const count = firstPick(await local_db.execA(sql, [table + "__crsql_itrig"]));

	return l.done(Boolean(count));
}

/**
 * @see https://github.com/vlcn-io/cr-sqlite/blob/891fe9e0190dd20917f807d739c809e1bc32f6a3/core/rs/core/src/automigrate.rs#L236
 */
export async function drop_columns(local_db: DB, table: string, columns: string[]) {
	const l = logger.extend("drop_columns");
	l.start({ local_db, table, columns });

	if (!columns.length) {
		l.debug("no columns to drop, returning");
		return l.done();
	}

	await local_db.exec('DROP VIEW IF EXISTS "?"', [`${table}_fractindex`]);
	for (const col of columns) {
		await local_db.exec('ALTER TABLE "?" DROP "?"', [table, col]);
	}

	return l.done();
}

/**
 * @see https://github.com/vlcn-io/cr-sqlite/blob/891fe9e0190dd20917f807d739c809e1bc32f6a3/core/rs/core/src/automigrate.rs#L256
 */
export async function add_columns(local_db: DB, table: string, columns: string[], mem_db: DB) {
	const l = logger.extend("add_columns");
	l.start({ local_db, table, columns, mem_db });

	if (!columns.length) {
		l.debug("no columns to add");
		return l.done();
	}

	const placeholder = `(${columns.map(() => "?").join(", ")})`;
	const sql = `SELECT name, type, "notnull", dflt_value, pk FROM pragma_table_info(?) WHERE name IN (${placeholder})`;

	const res = await mem_db.execA<[string, string, number, unknown, number]>(sql, [table, ...columns]);

	let processed_cols = 0;
	for (const col of res) {
		const [name, col_type, nutnull, dflt_val, pk] = col;
		if (pk) {
			throw new Error("Adding primary key columns to existing tables is not supported in auto-migration");
		}
		await add_column(local_db, table, name, col_type, nutnull, dflt_val);
		processed_cols += 1;
	}

	if (processed_cols !== columns.length) {
		throw new Error("Not all columns were processed during migration");
	}

	return l.done();
}

/**
 * @see https://github.com/vlcn-io/cr-sqlite/blob/891fe9e0190dd20917f807d739c809e1bc32f6a3/core/rs/core/src/automigrate.rs#L301
 */
export async function add_column(local_db: DB, table: string, name: string, col_type: string, notnull: number, dflt_val: unknown) {
	const l = logger.extend("add_column");
	l.start({ local_db, table, name, col_type, notnull, dflt_val });

	const dflt_val_str = dflt_val === null ? "" : `DEFAULT ${dflt_val}`;

	await local_db.exec(`ALTER TABLE "${table}" ADD COLUMN "${name}" ${col_type} ${notnull ? "NOT NULL" : ""} ${dflt_val_str}`);

	return l.done();
}

/**
 * @see https://github.com/vlcn-io/cr-sqlite/blob/891fe9e0190dd20917f807d739c809e1bc32f6a3/core/rs/core/src/automigrate.rs#L328
 */
export async function maybe_update_indices(local_db: DB, table: string, mem_db: DB) {
	const l = logger.extend("maybe_update_indices");
	l.start({ local_db, table, mem_db });

	// We do not pull PK indices because we do not support alterations that change
	// primary key definitions.
	// User would need to perform a manual migration for that.
	// This is due to the fact that SQLite itself does not support changing primary key
	// definitions in alter table statements.
	const sql = "SELECT name FROM pragma_index_list(?) WHERE origin != 'pk';";

	const local_indices = await local_db.execA(sql, [table]).then((res) => new Set(res.map(([name]) => name)));
	const mem_indices = await mem_db.execA(sql, [table]).then((res) => new Set(res.map(([name]) => name)));

	const removed: string[] = [];
	const maybe_modified: string[] = [];

	for (const idx of local_indices) {
		if (!mem_indices.has(idx)) {
			removed.push(idx);
		} else {
			maybe_modified.push(idx);
		}
	}

	await drop_indices(local_db, removed);
	// no add, schema file application will add
	for (const idx of maybe_modified) {
		await maybe_recreate_index(local_db, table, idx, mem_db);
	}

	return l.done();
}

/**
 * @see https://github.com/vlcn-io/cr-sqlite/blob/891fe9e0190dd20917f807d739c809e1bc32f6a3/core/rs/core/src/automigrate.rs#L374
 */
export async function drop_indices(local_db: DB, dropped: string[]) {
	const l = logger.extend("drop_indices");
	l.start({ local_db, dropped });

	if (!dropped.length) {
		l.debug("no indices to drop");
		return l.done();
	}

	// drop if exists given column dropping could have destroyed the index
	// already.
	for (const idx of dropped) {
		const sql = `DROP INDEX IF EXISTS "${idx}"`;
		await local_db.exec(sql);
	}

	return l.done();
}

/**
 * SQLite does not support alter index statements.
 * What we are doing here is looking to see if indices with the same
 * name have different definitions.
 *
 * If so, drop the index and re-create it with the new definiton.
 *
 * @see https://github.com/vlcn-io/cr-sqlite/blob/891fe9e0190dd20917f807d739c809e1bc32f6a3/core/rs/core/src/automigrate.rs#L396
 *
 */
export async function maybe_recreate_index(local_db: DB, table: string, idx: string, mem_db: DB) {
	const l = logger.extend("maybe_recreate_index");
	l.start({ local_db, table, idx, mem_db });

	const IS_UNIQUE_IDX_SQL = `SELECT "unique" FROM pragma_index_list(?) WHERE name = ?`;
	const IDX_COLS_SQL = `SELECT name FROM pragma_index_info(?) ORDER BY seqno ASC`;

	const is_unique_local = firstPick(await local_db.execA<[number]>(IS_UNIQUE_IDX_SQL, [table, idx]));
	const is_unique_mem = firstPick(await mem_db.execA<[number]>(IS_UNIQUE_IDX_SQL, [table, idx]));

	if (is_unique_local === undefined || !is_unique_mem === undefined) {
		throw new Error(
			"Trying to recreate an index that doesn't exist in both DBs - this probably indicates an error in the automigration code as it should never happen"
		);
	}

	// NOTE: Here the Rust code drops the prepared statement in order to free the index (not having open statements against it),
	// but we're safe here as our queries are done in a (high-level) req-res manner

	const idx_cols_local = await local_db.execA<[string]>(IDX_COLS_SQL, [idx]).then((res) => res.map(([name]) => name));
	const idx_cols_mem = await local_db.execA<[string]>(IDX_COLS_SQL, [idx]).then((res) => res.map(([name]) => name));

	// NOTE: This differs slightly from the Rust code: The Rust code (running within the SQLite process)
	// - iterates over (both local and mem) index result rows in lockstep, as long as 'next' for both are defined and checks each step for equality
	// - finally, it checks the final step for equality (expecting both to be end of result -- implying the same length)
	// (see the original function for details)
	//
	// here we're doing things slightly differently (in opposite order):
	// - we first check the lengths of both index definitions
	// - if same, we perform the zip check
	if (idx_cols_local.length !== idx_cols_mem.length) {
		return recreate_index(local_db, idx);
	}

	for (const [[a], [b]] of zip(idx_cols_local, idx_cols_mem)) {
		if (a !== b) {
			// NOTE: Here the Rust code drops the prepared statement in order to free the index (not having open statements against it),
			// but we're safe here as our queries are done in a (high-level) req-res manner
			return recreate_index(local_db, idx);
		}
	}

	return l.done();
}

/**
 * @see https://github.com/vlcn-io/cr-sqlite/blob/891fe9e0190dd20917f807d739c809e1bc32f6a3/core/rs/core/src/automigrate.rs#L447
 */
export async function recreate_index(local_db: DB, idx: string) {
	const l = logger.extend("recreate_index");
	l.start({ local_db, idx });

	const indices = [idx];
	await drop_indices(local_db, indices);

	// no need to call add_indices
	// they'll be added later with schema reapplication

	return l.done();
}
