import { describe, test, expect } from "vitest";

import { StockMap } from "./StockMap";

describe("StockMap", () => {
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
