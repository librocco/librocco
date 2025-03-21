import { getDB, initializeDB, getChanges, applyChanges, getSiteId, getPeerDBVersion } from "../db";
import { upsertCustomer, addBooksToCustomer } from "../customers";
import { upsertBook } from "../books";
import { type DB } from "../types";
import { upsertSupplier, associatePublisher } from "../suppliers";

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

export const createCustomerOrders = async (db: DB) => {
	// Add three books
	await upsertBook(db, { isbn: "1", publisher: "MathsAndPhysicsPub", title: "Physics", price: 7 });
	await upsertBook(db, { isbn: "2", publisher: "ChemPub", title: "Chemistry", price: 13 });
	await upsertBook(db, { isbn: "3", publisher: "PhantasyPub", title: "The Hobbit", price: 5 });
	// NOTE: the following have no supplier assigned to them
	await upsertBook(db, { isbn: "4", title: "The Secret of Secrets", authors: "Dan Brown", publisher: "Barnes and Noble", price: 60 });
	await upsertBook(db, {
		isbn: "666",
		title: "The Nine Gates of the Kingdom of Shadows",
		authors: "Aristide de Torchia",
		price: 100_000_000
	});

	// There is an old order that has been completely fullfilled
	await upsertCustomer(db, { fullname: "An older order", id: 100, displayId: "100" });
	const sql = "INSERT INTO customer_order_lines (customer_id, isbn, created, placed, received, collected) VALUES (?, ?, ?, ?, ?, ?);";
	const params = [
		100,
		"1",
		new Date("2024-10-20").getTime(),
		new Date("2024-10-21").getTime(),
		new Date("2024-10-22").getTime(),
		new Date("2024-10-23").getTime()
	];
	await db.exec(sql, params);

	// Two customers order some books
	await upsertCustomer(db, { fullname: "John Doe", id: 1, displayId: "1" });
	await addBooksToCustomer(db, 1, ["1", "2", "3"]);

	await upsertCustomer(db, { fullname: "Jane Doe", id: 2, displayId: "2" });
	await addBooksToCustomer(db, 2, ["3"]);

	// NOTE: No publisher
	await upsertCustomer(db, { fullname: "Boris Balkan", id: 4, displayId: "4" });
	await addBooksToCustomer(db, 4, ["666"]);

	// NOTE: No supplier associated with the publisher
	await upsertCustomer(db, { fullname: "James Doe", id: 5, displayId: "5" });
	await addBooksToCustomer(db, 5, ["4"]);

	// We have two different suppliers
	await upsertSupplier(db, { id: 1, name: "Science Books LTD" });
	await upsertSupplier(db, { id: 2, name: "Phantasy Books LTD" });

	// Publishers are associated with suppliers
	await associatePublisher(db, 1, "MathsAndPhysicsPub");
	await associatePublisher(db, 1, "ChemPub");
	await associatePublisher(db, 2, "PhantasyPub");
};
