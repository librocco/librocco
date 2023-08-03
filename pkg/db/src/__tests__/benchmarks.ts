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

	for (const note of notes) {
		await (note.type === "inbound" ? db.warehouse(note.books[0].warehouseId).create() : db.warehouse().create())
			.then((w) => w.note(note.id).create())
			.then((n) => n.addVolumes(...note.books))
			.then((n) => n.commit({}));
	}

	// Since we've implemented pagination, we need to make assertions per page basis.
	const numPages = Math.ceil(fullStock.books.length / 10);
	const stockPerPage = [];
	for (let page = 0; page < numPages; page++) {
		stockPerPage.push(fullStock.books.slice(page * 10, (page + 1) * 10));
	}

	await Promise.all(
		stockPerPage.map(async (stock, page) => {
			const { rows } = await firstValueFrom(db.warehouse().stream().entries({}, page));

			expect(rows).toEqual(
				stock.map(({ warehouseId, ...volumeStock }) =>
					expect.objectContaining({
						...volumeStock,
						// We're versioning the warehouseId at assertions, rather than at data generation
						warehouseId: `${version}/${warehouseId}`
					})
				)
			);
		})
	);
};
