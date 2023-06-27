import { describe, test, expect } from "vitest";

import { StockMap } from "./StockMap";

describe("StockMap Map interface", () => {
	test("should index the element using tuple as if value, not reference", () => {
		const map = new StockMap();

		map.set(["12345678", "wh1"], { quantity: 10 });

		expect(map.has(["12345678", "wh1"])).toEqual(true);
		expect(map.get(["12345678", "wh1"])).toEqual({ quantity: 10 });

		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		map.get(["12345678", "wh1"])!.quantity = 20;

		expect(map.get(["12345678", "wh1"])).toEqual({ quantity: 20 });

		expect(map.delete(["12345678", "wh1"])).toEqual(true);

		expect(map.has(["12345678", "wh1"])).toEqual(false);
	});

	test("should keep the 'size' the same value as the internal map", () => {
		const map = new StockMap();

		expect(map.size).toEqual(0);

		map.set(["12345678", "wh1"], { quantity: 10 });
		map.set(["12345678", "wh2"], { quantity: 10 });

		expect(map.size).toEqual(2);

		map.delete(["12345678", "wh1"]);

		expect(map.size).toEqual(1);

		map.clear();

		expect(map.size).toEqual(0);
	});

	// This is hiding the fact that the internal map is a Map<string, { quantity: number }>
	test("should iterate over the elements as if the underlaying map is a Map<[string, string], { quantity: number }>", () => {
		const map = new StockMap();

		map.set(["12345678", "wh1"], { quantity: 10 });
		map.set(["12345678", "wh2"], { quantity: 10 });

		const values = [...map.values()];
		expect(values).toEqual([{ quantity: 10 }, { quantity: 10 }]);

		const keys = [...map.keys()];
		expect(keys).toEqual([
			["12345678", "wh1"],
			["12345678", "wh2"]
		]);

		const entries = [...map.entries()];
		expect(entries).toEqual([
			[["12345678", "wh1"], { quantity: 10 }],
			[["12345678", "wh2"], { quantity: 10 }]
		]);

		expect([...map]).toEqual(entries);

		// All of the iterators should be reusable
		expect([...map]).toEqual(entries);
		expect([...map.values()]).toEqual(values);
		expect([...map.keys()]).toEqual(keys);
		expect([...map.entries()]).toEqual(entries);
	});
});

describe("StockMap '.aggregage' method", () => {
	test("should aggregate the quantity by [isbm, warehouse] of entries passed as argument", () => {
		const m = new StockMap();

		m.aggragate([
			{ isbn: "12345678", warehouseId: "wh1", quantity: 10, noteType: "inbound" },
			{ isbn: "12345678", warehouseId: "wh2", quantity: 10, noteType: "inbound" },
			{ isbn: "12345678", warehouseId: "wh1", quantity: 5, noteType: "inbound" }
		]);

		expect([...m]).toEqual([
			[["12345678", "wh1"], { quantity: 15 }],
			[["12345678", "wh2"], { quantity: 10 }]
		]);
	});

	test("quantity from 'outbound' entries should be subtracted", () => {
		const m = new StockMap();

		m.aggragate([
			{ isbn: "12345678", warehouseId: "wh1", quantity: 10, noteType: "inbound" },
			{ isbn: "12345678", warehouseId: "wh2", quantity: 10, noteType: "inbound" },
			{ isbn: "12345678", warehouseId: "wh1", quantity: 5, noteType: "outbound" }
		]);

		expect([...m]).toEqual([
			[["12345678", "wh1"], { quantity: 5 }],
			[["12345678", "wh2"], { quantity: 10 }]
		]);
	});

	test("should remove the entry if the quantity is 0", () => {
		const m = new StockMap();

		m.aggragate([
			{ isbn: "12345678", warehouseId: "wh1", quantity: 10, noteType: "inbound" },
			{ isbn: "12345678", warehouseId: "wh2", quantity: 10, noteType: "inbound" },
			{ isbn: "12345678", warehouseId: "wh2", quantity: 10, noteType: "outbound" }
		]);

		expect([...m]).toEqual([[["12345678", "wh1"], { quantity: 10 }]]);
	});

	test("should disregard entries with 0 quantity", () => {
		const m = new StockMap();

		m.aggragate([
			{ isbn: "12345678", warehouseId: "wh1", quantity: 10, noteType: "inbound" },
			{ isbn: "12345678", warehouseId: "wh2", quantity: 0, noteType: "inbound" }
		]);

		expect([...m]).toEqual([[["12345678", "wh1"], { quantity: 10 }]]);
	});

	test("should account for additional aggregation calls", () => {
		const m = new StockMap();

		m.aggragate([{ isbn: "12345678", warehouseId: "wh1", quantity: 10, noteType: "inbound" }]);
		m.aggragate([{ isbn: "12345678", warehouseId: "wh1", quantity: 10, noteType: "inbound" }]);

		expect([...m]).toEqual([[["12345678", "wh1"], { quantity: 20 }]]);
	});

	test("should aggregate the initial entries if instantiated with an iterable (passed into the constructor)", () => {
		const m = new StockMap([
			{ isbn: "12345678", warehouseId: "wh1", quantity: 10, noteType: "inbound" },
			{ isbn: "12345678", warehouseId: "wh2", quantity: 10, noteType: "inbound" }
		]);

		expect([...m]).toEqual([
			[["12345678", "wh1"], { quantity: 10 }],
			[["12345678", "wh2"], { quantity: 10 }]
		]);
	});
});

describe("StockMap rows", () => {
	test("returns an iterable of VolumeStock rows", () => {
		const m = new StockMap([
			{ isbn: "12345678", warehouseId: "wh1", quantity: 10, noteType: "inbound" },
			{ isbn: "12345678", warehouseId: "wh2", quantity: 10, noteType: "inbound" }
		]);

		expect([...m.rows()]).toEqual([
			{ isbn: "12345678", warehouseId: "wh1", quantity: 10 },
			{ isbn: "12345678", warehouseId: "wh2", quantity: 10 }
		]);
	});
});

describe("StockMap subsets ('.byWarehouse' and '.byIsbn' methods)", () => {
	test("should return an iterable of entries filtered by warehouseId", () => {
		const m = new StockMap([
			{ isbn: "12345678", warehouseId: "wh1", quantity: 10, noteType: "inbound" },
			{ isbn: "12345678", warehouseId: "wh2", quantity: 10, noteType: "inbound" },
			{ isbn: "11111111", warehouseId: "wh1", quantity: 5, noteType: "inbound" }
		]);

		expect([...m.warehouse("wh1")]).toEqual([
			[["12345678", "wh1"], { quantity: 10 }],
			[["11111111", "wh1"], { quantity: 5 }]
		]);
	});

	test("should return an iterable of entries filtered by isbn", () => {
		const m = new StockMap([
			{ isbn: "12345678", warehouseId: "wh1", quantity: 10, noteType: "inbound" },
			{ isbn: "12345678", warehouseId: "wh2", quantity: 10, noteType: "inbound" },
			{ isbn: "11111111", warehouseId: "wh1", quantity: 5, noteType: "inbound" }
		]);

		expect([...m.isbn("12345678")]).toEqual([
			[["12345678", "wh1"], { quantity: 10 }],
			[["12345678", "wh2"], { quantity: 10 }]
		]);
	});
});
