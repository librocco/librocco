import { describe, it, expect } from "vitest";

import { getRandomDb } from "./lib";

import { upsertWarehouse, getAllWarehouses } from "../warehouse";

describe("Warehouse tests", () => {
	it("creates a new warehouse, using only id, with default fields", async () => {
		const db = await getRandomDb();

		await upsertWarehouse(db, { id: 1 });

		const res = await getAllWarehouses(db);
		expect(res).toEqual([{ id: 1, displayName: "New Warehouse", discount: 0 }]);
	});

	it("creates a new warehouse with full provided values", async () => {
		const db = await getRandomDb();

		await upsertWarehouse(db, { id: 1, displayName: "Central Warehouse", discount: 10 });

		const res = await getAllWarehouses(db);
		expect(res).toEqual([{ id: 1, displayName: "Central Warehouse", discount: 10 }]);
	});

	it("updates single values in a predictable way", async () => {
		const db = await getRandomDb();

		// Insert initial warehouse
		await upsertWarehouse(db, { id: 1, displayName: "Old Name", discount: 5 });

		// Update display name
		await upsertWarehouse(db, { id: 1, displayName: "New Warehouse" });

		let res = await getAllWarehouses(db);
		expect(res).toEqual([{ id: 1, displayName: "New Warehouse", discount: 5 }]);

		// Update discount
		await upsertWarehouse(db, { id: 1, discount: 15 });
		res = await getAllWarehouses(db);
		expect(res).toEqual([{ id: 1, displayName: "New Warehouse", discount: 15 }]);
	});

	it("assigns default warehouse name continuing the sequence", async () => {
		const db = await getRandomDb();

		// Create warehouse 1, default name should be 'New Warehouse'
		await upsertWarehouse(db, { id: 1 });
		let res = await getAllWarehouses(db);
		expect(res).toEqual([{ id: 1, displayName: "New Warehouse", discount: 0 }]);

		// Create warehouse 2, default name should be 'New Warehouse (2)'
		await upsertWarehouse(db, { id: 2 });
		res = await getAllWarehouses(db);
		expect(res).toEqual([
			{ id: 1, displayName: "New Warehouse", discount: 0 },
			{ id: 2, displayName: "New Warehouse (2)", discount: 0 }
		]);

		// Rename warehouse 1 to 'Warehouse 1'
		await upsertWarehouse(db, { id: 1, displayName: "Warehouse 1" });
		res = await getAllWarehouses(db);
		expect(res).toEqual([
			{ id: 1, displayName: "Warehouse 1", discount: 0 },
			{ id: 2, displayName: "New Warehouse (2)", discount: 0 }
		]);

		// Create warehouse 3, default name should be 'New Warehouse (3)' (continuing the sequence)
		await upsertWarehouse(db, { id: 3 });
		res = await getAllWarehouses(db);
		expect(res).toEqual([
			{ id: 1, displayName: "Warehouse 1", discount: 0 },
			{ id: 2, displayName: "New Warehouse (2)", discount: 0 },
			{ id: 3, displayName: "New Warehouse (3)", discount: 0 }
		]);

		// Rename warehouse 2 to 'Warehouse 2'
		await upsertWarehouse(db, { id: 2, displayName: "Warehouse 2" });
		// Rename warehouse 3 to 'Warehouse 3'
		await upsertWarehouse(db, { id: 3, displayName: "Warehouse 3" });
		res = await getAllWarehouses(db);
		expect(res).toEqual([
			{ id: 1, displayName: "Warehouse 1", discount: 0 },
			{ id: 2, displayName: "Warehouse 2", discount: 0 },
			{ id: 3, displayName: "Warehouse 3", discount: 0 }
		]);

		// Create warehouse 4, default name should be 'New Warehouse' (restarting the sequence)
		await upsertWarehouse(db, { id: 4 });
		res = await getAllWarehouses(db);
		expect(res).toEqual([
			{ id: 1, displayName: "Warehouse 1", discount: 0 },
			{ id: 2, displayName: "Warehouse 2", discount: 0 },
			{ id: 3, displayName: "Warehouse 3", discount: 0 },
			{ id: 4, displayName: "New Warehouse", discount: 0 }
		]);
	});
});
