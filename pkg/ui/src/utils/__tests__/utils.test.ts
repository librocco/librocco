import { describe, test, expect } from "vitest";

import { filterPositionClass } from "../styles";

describe("UI utils", () => {
	describe("filterPositionClass", () => {
		test("should filter the position class from 'baseClasses' array", () => {
			const baseClasses = ["mx-4", "w-2", "relative"];
			const res = filterPositionClass("absolute mx-2", baseClasses);
			expect(res).toEqual(["mx-4", "w-2"]);
		});
	});
});
