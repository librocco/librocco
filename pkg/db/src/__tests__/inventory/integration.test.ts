import { describe, test, expect, beforeEach, beforeAll } from "vitest";
import { firstValueFrom } from "rxjs";

import { __withDocker__ } from "@/__tests__/constants";

import * as implementations from "@/implementations/inventory";

import { newTestDB } from "@/__testUtils__/db";
import newInventoryDataLoader from "@/__testUtils__/inventoryDataLoader";

// Using 'describe.each' allows us to run tests against each version of the db interface implementation.
const schema = Object.entries(implementations).map(([version, getDB]) => ({ version, getDB }));

describe
	// Skip integration tests, if not testing with docker, as the data needed is loaded from the docker container.
	.skipIf(!__withDocker__)
	.each(schema)("Inventory unit tests: $version", ({ version, getDB }) => {
	let db = newTestDB(getDB);
	const dataLoader = newInventoryDataLoader();

	beforeAll(async () => {
		await dataLoader.load();
	});

	// Initialise a new db for each test
	beforeEach(async () => {
		db = newTestDB(getDB);
		await db.init();
	});

	test("commit20Notes", async () => {
		// We're awaiting 'getNotesAndWarehouses' as it's a promise, but data retrieval will
		// resolve immediately as we're loading the data in the 'beforeAll' hook - the data is loaded only once.
		const { fullStock, notes, warehouses } = await dataLoader.getNotesAndWarehouses(20);

		// Create warehouses and set displayNames to avoid sequential warehouse names (default values)
		// as they're hard to keep track of during banchmark/stress tests
		await Promise.all(
			warehouses.map(({ id }) =>
				db
					.warehouse(id)
					.create()
					.then((w) => w.setName({}, id))
			)
		);

		for (const note of notes) {
			await (note.type === "inbound" ? db.warehouse(note.books[0].warehouseId).create() : db.warehouse().create())
				.then((w) => w.note(note.id).create())
				.then((n) => n.addVolumes(...note.books))
				.then((n) => n.commit({}));
		}

		const { rows } = await firstValueFrom(db.warehouse().stream().entries({}));

		expect(rows).toEqual(
			fullStock.books.map(({ warehouseId, ...volumeStock }) =>
				expect.objectContaining({
					...volumeStock,
					// We're versioning the warehouseId at assertions, rather than at data generation
					warehouseId: `${version}/${warehouseId}`
				})
			)
		);
	});
});
