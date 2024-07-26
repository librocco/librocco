import PouchDB from "pouchdb";
import MemoryAdapter from "pouchdb-adapter-memory";

import { InventoryDatabaseInterface, OrdersDatabaseInterface } from "@/types";

import { __withDocker__ } from "@/__tests__/constants";

// Enable running of the tests against in-memory PouchDB
PouchDB.plugin(MemoryAdapter);

type Database = InventoryDatabaseInterface | OrdersDatabaseInterface;

export const newTestDB = <D extends Database>(newDatabase: (name: string, opts?: { test?: boolean }) => D): D => {
	// Get new db per test basis (ids are timestamped for easier debugging)
	const dbName = new Date().toISOString().replaceAll(/[.:]/g, "-").toLowerCase();
	const db = newDatabase(dbName, { test: true });

	// If testing with docker support, we're using the remote db to replicate to/from
	if (__withDocker__) {
		db.replicate().sync(`http://admin:admin@127.0.0.1:5001/test-${dbName}`, { live: true, retry: true });
	}

	return db;
};
