import { describe, test, expect } from "vitest";

import { iterableFromGenerator } from "./generators";

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
