import pouchdb from "pouchdb";

import { newInventoryDatabaseInterface, type InventoryDatabaseInterface } from "@librocco/db";

import { LOCAL_POUCH_DB_NAME } from "$lib/constants";
import { browser } from "$app/environment";

let db: InventoryDatabaseInterface = undefined;
// it's INITIALLY true because the db could be local/pouch
// in which case we'd only need the catch statement to set it to false let

let status = true;
let reason = "";

export const checkUrlConnection = async (url: string) => {
	const [credenialsAndUrl, urlEnd] = url.split("@");
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	const [_, credentials] = credenialsAndUrl.split("//");

	const headers = new Headers();
	const encodedCredentials = btoa(credentials);
	headers.append("Authorization", `Basic ${encodedCredentials}`);

	return fetch(`https://${urlEnd}`, {
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
export const createDB = async (url?: string): Promise<{ db: InventoryDatabaseInterface | undefined; status: boolean; reason: string }> => {
	if (db) {
		return { db, status: true, reason };
	}

	/**
	 * If a URL is passed, pouchdb will be used as a client only to speak with a couchdb instance.
	 * There will be no local persistence.
	 */
	let connectionUrl = LOCAL_POUCH_DB_NAME;
	if (url && browser) {
		try {
			const response = await checkUrlConnection(url);

			if (!response.ok) {
				status = false;
				reason = `Failed to connect to provided URL: ${response.status} ${response.statusText}`;
			} else {
				status = true;
				connectionUrl = url;
			}
		} catch (err) {
			status = false;
			reason = "Failed to connect to provided URL.";
		}
	}

	if (status) {
		const pouch = new pouchdb(connectionUrl);
		db = newInventoryDatabaseInterface(pouch);
		await db.init();
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
		await db._pouch.destroy();
		db = undefined;
	}
};
