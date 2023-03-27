import { expect } from "vitest";
import { firstValueFrom } from "rxjs";

import { TestFunction } from "@test-runner/types";

export const commit20Notes: TestFunction = async (db, version, getNotesAndWarehouses) => {
	const { fullStock, notes, warehouses } = getNotesAndWarehouses(20);

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

	const noteUpdates = notes.map((note) =>
		(note.type === "inbound" ? db.warehouse(note.books[0].warehouseId).create() : db.warehouse().create())
			.then((w) => w.note().create())
			.then((n) => n.addVolumes(...note.books))
			.then((n) => n.commit({}))
	);
	await Promise.all(noteUpdates);

	const stock = await firstValueFrom(db.warehouse().stream().entries({}));

	expect(stock).toEqual(
		fullStock.books.map(({ warehouseId, ...volumeStock }) =>
			expect.objectContaining({
				...volumeStock,
				// We're versioning the warehouseId at assertions, rather than at data generation
				warehouseId: `${version}/${warehouseId}`
			})
		)
	);
};
