import { get, writable } from "svelte/store";

import { newInventoryDatabaseInterface, type InventoryDatabaseInterface } from "@librocco/db";

import { browser } from "$app/environment";
import { persisted } from "svelte-local-storage-store";

class InitProcess {
	#db: DB;

	cancelled = false;

	private _promise: Promise<void>;

	constructor(db: DB) {
		this.#db = db;
	}

	promise() {
		return this._promise;
	}

	async execute() {
		const ctx = { name: "[db init]", debug: false };
		const instance = get(this.#db.instance);
		this._promise = new Promise<void>((res) => {
			instance
				.init(ctx)
				.then(() => !this.cancelled && this.#db._initComplete())
				.then(() => res())
				.catch((err) => (console.error(err), this.#db.ok.set(false)));
		});
		return this.promise();
	}

	cancel() {
		this.cancelled = true;
	}
}

class DB {
	name = persisted<string>("librocco-db-name", "");
	instance = writable<InventoryDatabaseInterface>(undefined);
	exists = writable<boolean>(false);
	ok = writable(true);
	ready = writable(false);
	error = writable<string>(undefined);

	private _initProcess: InitProcess | undefined;

	private _initNone() {
		this.name.set("");
		this.instance.set(undefined);
		this.exists.set(false);
		this.ok.set(true);
		this.error.set(undefined);
		this.ready.set(true);
		return this;
	}

	_initStart(instance: InventoryDatabaseInterface) {
		this.instance.set(instance);
		this.exists.set(true);
		this.ok.set(true);
		this.error.set(undefined);
		this.ready.set(false);

		this._initProcess = new InitProcess(this);
		return this._initProcess.execute();
	}

	_initComplete() {
		this.ready.set(true);
		this._initProcess = undefined;
	}

	_initError(err: string) {
		this.ready.set(true);
		this.ok.set(false);
		this.error.set(err);
	}

	async init(name: string): Promise<DB> {
		// If not in browser, we don't initialise the db, but signal that the instance is ready (in order to prerender the dashboard skeleton)
		if (!browser) return this._initNone();

		// If db already initialised, return
		if (name === get(this.name) && get(this.ready)) return this;

		// If db (with same name) is being initialised return the init process
		if (name === get(this.name) && this._initProcess) return this._initProcess.promise().then(() => this);

		// If db (with differnt name) is being initialised, replace the init process
		if (this._initProcess) this._initProcess.cancel();

		// Start the new init process

		this.name.set(name);
		const instance = newInventoryDatabaseInterface(name);

		await this._initStart(instance);

		return this;
	}

	select(name: string) {
		return this.init(name);
	}
}

export const dbController = new DB();

export const checkUrlConnection = async (url: string) => {
	const [credenialsAndUrl, urlEnd] = url.split("@");

	url = urlEnd === undefined ? url : `https://${urlEnd}`;

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	const [_, credentials] = credenialsAndUrl.split("//");

	const headers = new Headers();
	const encodedCredentials = btoa(credentials);
	headers.append("Authorization", `Basic ${encodedCredentials}`);

	return fetch(url, {
		method: "GET",
		headers: headers,
		credentials: "include"
	});
};
