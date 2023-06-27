import { describe, test, expect } from "vitest";

import { EmptyIterableError, filter, flatMap, iterableFromGenerator, map, reduce, slice, wrapIter } from "./generators";

describe("iterableFromGenerator", () => {
	test("should allow for multiple iterations over the same generator", () => {
		const genFn = function* () {
			yield 1;
			yield 2;
			yield 3;
		};

		const iterable = iterableFromGenerator(genFn);

		expect([...iterable]).toEqual([1, 2, 3]);
		expect([...iterable]).toEqual([1, 2, 3]);
	});
});

describe("Smoke test of transformers", () => {
	test("map", () => {
		const iterable = [1, 2, 3];
		const mapped = map(iterable, (value) => value + 1);
		expect([...mapped]).toEqual([2, 3, 4]);
	});

	test("flatMap", () => {
		const iterable = [
			[1, 2, 3],
			[4, 5, 6]
		];
		const flattened = flatMap(iterable, (value) => value);
		expect([...flattened]).toEqual([1, 2, 3, 4, 5, 6]);
	});

	test("filter", () => {
		const iterable = [1, 2, 3, 4, 5, 6];
		const filtered = filter(iterable, (value) => value % 2 === 0);
		expect([...filtered]).toEqual([2, 4, 6]);
	});

	test("reduce without seed", () => {
		const iterable = [1, 2, 3, 4, 5, 6];
		const reduced = reduce(iterable, (acc, value) => acc + value);
		expect(reduced).toEqual(21);
	});

	test("reduce with seed", () => {
		const iterable = [1, 2, 3, 4, 5, 6];
		const reduced = reduce(iterable, (acc, value) => acc + value, "");
		expect(reduced).toEqual("123456");
	});

	test("reduce with empty iterable without seed", () => {
		const iterable: number[] = [];
		let error;
		try {
			reduce(iterable, (acc, value) => acc + value);
		} catch (err) {
			error = err;
		}
		expect(error).toBeInstanceOf(EmptyIterableError);
	});

	test("reduce with empty iterable with seed", () => {
		const iterable: number[] = [];
		const reduced = reduce(iterable, (acc, value) => acc + value, 0);
		expect(reduced).toEqual(0);
	});

	test("slice", () => {
		const iterable = [1, 2, 3, 4, 5, 6];
		const sliced = slice(iterable, 1, 4);
		expect([...sliced]).toEqual([2, 3, 4]);
	});

	test("slice with end out of bounds", () => {
		const iterable = [1, 2, 3, 4, 5, 6];
		const sliced = slice(iterable, 1, 10);
		expect([...sliced]).toEqual([2, 3, 4, 5, 6]);
	});
});

describe("Composition with 'wrapIter'", () => {
	test("should produce the resulting iterable from the composition of the given transformers", () => {
		const iterable = [
			{ step: "1", rows: [1, 2] },
			{ step: "2", rows: [3, 4] },
			{ step: "3", rows: [5, 6] }
		];

		const result = wrapIter(iterable)
			.flatMap(({ rows }) => rows) // Iterable { 1, 2, 3, 4, 5, 6 }
			.map((value) => value + 1) // Iterable { 2, 3, 4, 5, 6, 7 }
			.filter((value) => value % 2 === 0) // Iterable { 2, 4, 6 }
			.map((value) => value.toString()); // Iterable { "2", "4", "6" }

		expect([...result]).toEqual(["2", "4", "6"]);
	});
});
