import PouchDB from "pouchdb";
import MemoryAdapter from "pouchdb-adapter-memory";
import { v4 as uuid } from "uuid";

import { newDatabaseInterface } from "@librocco/db";

// Enable running of the tests against in-memory PouchDB
PouchDB.plugin(MemoryAdapter);

/** Creates a new db interface using pouchdb with unique id and memory adapter */
export const newTestDB = () => {
	const db = new PouchDB(uuid(), { adapter: "memory" });
	return newDatabaseInterface(db).init({}, {});
};
