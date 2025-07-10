import { describe, it, expect } from "vitest";

import { matchesName } from "../misc";

describe("matchesName", () => {
	it("should find a simple exact match", () => {
		const customerName = "John Doe";
		const searchString = "John Doe";
		expect(matchesName(searchString, customerName)).toBe(true);
	});

	it("should match regardless of case", () => {
		const customerName = "John Doe";
		const searchString = "john doe";
		expect(matchesName(searchString, customerName)).toBe(true);
	});

	it("should match regardless of word order in search string", () => {
		const customerName = "John Doe";
		const searchString = "Doe John";
		expect(matchesName(searchString, customerName)).toBe(true);
	});

	it("should handle and ignore extra whitespace", () => {
		const customerName = "John Doe";
		const searchString = "  John   Doe  ";
		expect(matchesName(searchString, customerName)).toBe(true);
	});

	it("should match partial names if all parts of search exist", () => {
		const customerName = "John Fitzgerald Doe";
		const searchString = "John Doe";
		expect(matchesName(searchString, customerName)).toBe(true);
	});

	it("should match substrings within names", () => {
		const customerName = "Johnathan Doe";
		const searchString = "john doe";
		expect(matchesName(searchString, customerName)).toBe(true);
	});

	it("should not match if not all search terms are present", () => {
		const customerName = "John Doe";
		const searchString = "John Smith";
		expect(matchesName(searchString, customerName)).toBe(false);
	});

	it("should handle punctuation in both customer name and search string", () => {
		const customerName = "O'Malley, John";
		expect(matchesName("john o'malley", customerName)).toBe(true);
		expect(matchesName("john o malley", customerName)).toBe(true);
	});

	it("should return true for an empty search string", () => {
		expect(matchesName("", "John Doe")).toBe(true);
	});
});
