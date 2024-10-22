import { getDB, initializeDB, getChanges, applyChanges, getSiteId, getPeerDBVersion } from "../db";
import { type DB } from "../types";

export const getRandomDb = async (): Promise<DB> => {
	// Each test run will use a different db
	// birthday paradox chance of collision for 1k runs is 0.5%)
	const randomTestRunId = Math.floor(Math.random() * 100000000);
	const db = await getDB("testdb" + randomTestRunId);
	await initializeDB(db);
	return db;
};

export const getRandomDbs = async (): Promise<DB[]> => {
	const randomTestRunId = Math.floor(Math.random() * 100000000);
	const db1 = await getDB("testdb1" + randomTestRunId);
	const db2 = await getDB("testdb2" + randomTestRunId);
	await initializeDB(db1);
	await initializeDB(db2);
	return [db1, db2];
};

export const syncDBs = async (source: DB, destination: DB) => {
	const sourceDBVersion = await getPeerDBVersion(source, await getSiteId(destination));
	await applyChanges(destination, await getChanges(source, sourceDBVersion));
};
