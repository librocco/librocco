import { describe, test, expect } from "vitest";

import { iterableFromGenerator, wrapIter } from "./generators";

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

describe("Composition with 'transform'", () => {
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
