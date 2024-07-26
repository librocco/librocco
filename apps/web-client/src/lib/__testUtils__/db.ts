import { v4 as uuid } from "uuid";
import PouchDB from "pouchdb";
import MemoryAdapter from "pouchdb-adapter-memory";

import { newInventoryDatabaseInterface } from "@librocco/db";

// Enable running of the tests against in-memory PouchDB
//
// I have no idea why TS is complaining about the following line - everything works
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
PouchDB.plugin(MemoryAdapter);

/** Creates a new db interface using pouchdb with unique id and memory adapter */
export const newTestDB = async () => {
	const db = newInventoryDatabaseInterface(uuid(), { test: true });
	await db.init();
	return db;
};
