import { get } from "svelte/store";

import { newInventoryDatabaseInterface, type InventoryDatabaseInterface } from "@librocco/db";

import { browser } from "$app/environment";
import { persisted } from "svelte-local-storage-store";

let db: InventoryDatabaseInterface = undefined;
// it's INITIALLY true because the db could be local/pouch
// in which case we'd only need the catch statement to set it to false let

let status = true;
let reason = "";

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

/**
 * We're using createDB() instead of exporting the db itself because we don't want to
 * instantiate the db on the server, as it leaves annoying '/dev' folder on the filesystem and
 * we're using pouch in the browser only.
 *
 * It should be initialized in the browser environment and is idempotent (if the db is already instantiated, it will return the existing instance).
 * This is to prevent expensive `db.init()` operations on each route change.
 */
export const createDB = async (name: string): Promise<{ db: InventoryDatabaseInterface | undefined; status: boolean; reason: string }> => {
	if (db && name === get(currentDB)) {
		return { db, status: true, reason };
	}

	/**
	 * If a URL is passed, pouchdb will be used as a client only to speak with a couchdb instance.
	 * There will be no local persistence.
	 */
	// const url = _url || LOCAL_POUCH_DB_NAME;
	if (browser) {
		try {
			db = newInventoryDatabaseInterface(name);

			const ctx = { name: "[db init]", debug: false };
			await db.init(ctx);

			status = true;
		} catch (err) {
			console.error(err);
			status = false;
			reason = "Failed to connect to provided URL.";
		}
	}

	return { db, status, reason };
};

/**
 * Get db returns the instantiated db instance. It's safe to run this in any environment (browser/server)
 * as, it will simply return undefined if the db is not instantiated.
 */
export const getDB = (): { db: InventoryDatabaseInterface | undefined; status: boolean; reason: string } => {
	return { db, status, reason };
};

export const destroyDB = async () => {
	if (db) {
		await db.destroy();
		db = undefined;
	}
};

export const currentDB = persisted("librocco-current-db", "dev");
export const select = async (name: string) => {
	if (get(currentDB) === name) return;
	await createDB(name);
	currentDB.set(name);
};
