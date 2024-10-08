// empty test
import { beforeEach, describe, test } from "vitest";
import * as implementations from "@/implementations/orders";
import { newTestDB } from "@/__testUtils__/db";

const schema = Object.entries(implementations).map(([version, getDB]) => ({ version, getDB }));
describe.each(schema)("New test: $version", ({ getDB }) => {
	let db;

	// Initialise a new db for each test
	beforeEach(async () => {
		db = newTestDB(getDB);
		await db.init();
	});

	test.only("My smoke test", async () => {
		console.log("here");
	});
});
