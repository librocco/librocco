import { describe, it, expect } from "vitest";

import { normalizeName } from "../misc"; // Adjust the import path as needed

describe("normalizeName", () => {
	it("should remove commas", () => {
		expect(normalizeName("Doe, John")).toBe("Doe John");
	});

	it("should split by whitespace and sort parts alphabetically", () => {
		expect(normalizeName("John Doe")).toBe("Doe John");
		expect(normalizeName("Jane Anne Doe")).toBe("Anne Doe Jane");
	});

	it("should handle multiple spaces between words", () => {
		expect(normalizeName("John   Doe")).toBe("Doe John");
	});

	it("should trim leading and trailing whitespace", () => {
		expect(normalizeName("  John Doe  ")).toBe("Doe John");
	});

	it("should handle names with commas and multiple spaces, then sort", () => {
		expect(normalizeName("  Doe,   John   Alpha  ")).toBe("Alpha Doe John");
	});

	it("should return an empty string if input is empty", () => {
		expect(normalizeName("")).toBe("");
	});

	it("should return an empty string if input is only whitespace", () => {
		expect(normalizeName("   ")).toBe("");
	});

	it("should handle single word names", () => {
		expect(normalizeName("Madonna")).toBe("Madonna");
	});

	it("should handle names with mixed case, sorting should be case-sensitive by default if not handled by sort", () => {
		// JavaScript's default sort is case-sensitive ('Z' < 'a').
		// The current implementation converts to lowercase before sorting.
		// If the requirement was case-sensitive sorting of original parts, the test would be different.
		// However, the provided implementation normalizes to lowercase within the function logic before sorting.
		// The example below tests the current behavior.
		expect(normalizeName("apple Banana")).toBe("Banana apple"); // Based on
		// current implementation, sorting happens after splitting.
	});

	it("should correctly sort names with similar prefixes", () => {
		expect(normalizeName("Smith John Smithson Jane")).toBe("Jane John Smith Smithson");
	});
});
