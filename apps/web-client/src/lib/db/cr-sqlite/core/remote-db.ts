/* eslint-disable @typescript-eslint/no-unused-vars */
import { SQLiteError } from "@vlcn.io/wa-sqlite";
import type { DBAsync, OnUpdateCallback, StmtAsync, TMutex, TXCallback, _TXAsync } from "./types";

export async function getRemoteDB(url: string, dbname: string): Promise<DBAsync> {
	const db = new RemoteDB(url, dbname);
	try {
		await db.comm.ping();
		return db;
	} catch (err) {
		throw new Error(`Error opening remote db url: ${url}, dbame: ${dbname}, error: ${err.toString()}`);
	}
}

async function rpc<T>(url: string, body: any, token?: string): Promise<T> {
	const res = await fetch(url, {
		method: "POST",
		headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
		body: JSON.stringify(body)
	});

	if (!res.ok) {
		const json = await res.json();
		if (json?.isSQLiteError) {
			const { message, code } = json;
			throw new SQLiteError(message, code);
		}
		throw new Error(`${res.status}: ${res.statusText}`);
	}

	return res.json();
}

type QueryResp<R extends any[]> = { rows: R };

class Comm {
	constructor(
		private readonly url: string,
		private readonly dbname: string
	) {}

	private get _httpUrl() {
		const url = new URL(this.url);
		url.protocol = ["https:", "wss:"].includes(url.protocol) ? "https:" : "http:";
		return url;
	}

	async ping() {
		const res = await fetch(this._httpUrl);
		if (!res.ok) {
			throw new Error(`Failed to reach server: ${res.status} ${res.statusText}`);
		}
	}

	async exec<R extends any[] = null>(sql: string, bind: SQLiteCompatibleType[]): Promise<QueryResp<R>> {
		const url = [this._httpUrl, this.dbname, "exec"].join("/").replace(/\/+/g, "/").replace(":/", "://");
		try {
			return await rpc<QueryResp<R>>(url, { sql, bind });
		} catch (err) {
			console.error(`Failed running ${sql} ${err.toString()}`);
			throw err;
		}
	}
}

class RemoteDB implements DBAsync {
	comm: Comm;

	constructor(url: string, dbname: string) {
		this.comm = new Comm(url, dbname);
	}

	get siteid(): string {
		throw new Error("unimplemented");
	}

	get filename(): string {
		throw new Error("unimplemented");
	}

	get __mutex(): TMutex {
		throw new Error("unimplemented");
	}

	get tablesUsedStmt(): StmtAsync {
		throw new Error("unimplemented");
	}

	prepare(sql: string): Promise<StmtAsync> {
		throw new Error("unimplemented");
	}

	async exec(sql: string, bind: SQLiteCompatibleType[]): Promise<any> {
		const { rows } = await this.comm.exec(sql, bind);
		return rows;
	}

	execMany(sql: string[]): Promise<void> {
		throw new Error("unimplemented");
	}

	async execO<O extends Record<string, any>>(sql: string, bind: SQLiteCompatibleType[]): Promise<O[]> {
		const { rows } = await this.comm.exec<O[]>(sql, bind);
		return rows;
	}

	async execA<T extends any[]>(sql: string, bind: SQLiteCompatibleType[]): Promise<T[]> {
		const { rows } = await this.comm.exec<T[]>(sql, bind);
		return rows.map((r) => Object.values(r) as T);
	}

	async close() {
		throw new Error("unimplemented");
	}

	createFunction(name: string, fn: (...args: any) => unknown, opts?: Record<string, any>) {
		throw new Error("unimplemented");
	}

	onUpdate(cb: OnUpdateCallback): () => void {
		throw new Error("unimplemented");
	}

	tx(cb: TXCallback): Promise<void> {
		throw new Error("unimplemented");
	}

	imperativeTx(): Promise<[() => void, _TXAsync]> {
		throw new Error("unimplemented");
	}

	automigrateTo(schemaName: string, schemaContent: string): Promise<"noop" | "apply" | "migrate"> {
		throw new Error("unimplemented");
	}
}
