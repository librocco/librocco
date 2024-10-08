import { InventoryDatabaseInterface, OrdersDatabaseInterface } from "@/types";

import { __withDocker__ } from "@/__tests__/constants";

type Database = InventoryDatabaseInterface | OrdersDatabaseInterface;

export const newTestDB = <D extends Database>(newDatabase: (name: string, opts?: { test?: boolean }) => D): D => {
	// Get new db per test basis (ids are timestamped for easier debugging)
	const dbName = new Date().toISOString().replaceAll(/[.:]/g, "-").toLowerCase();
	const db = newDatabase(dbName, { test: true });

	return db;
};
