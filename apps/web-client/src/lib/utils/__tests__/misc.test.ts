import { describe, it, expect } from "vitest";

import { generateLoescherFormat, generatePearsonFormat, generateRcsFormat, generateStandardFormat, matchesName } from "../misc";

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
describe("Order file generation", () => {
	const mockSupplier = {
		customerId: 913186
	};

	const mockLines = [
		{ isbn: "978-88-6910-245-5", quantity: 1, supplier_id: 1 },
		{ isbn: "9788869108402", quantity: 12, supplier_id: 1 },
		{ isbn: "978-88-6910-677-4", quantity: 99, supplier_id: 1 }
	];

	describe("generatePearsonFormat", () => {
		it("should generate a correctly formatted Pearson (PBM) order string", () => {
			const expected = ["0000913186978886910245500001LL", "0000913186978886910840200012LL", "0000913186978886910677400099LL"].join("\n");
			const result = generatePearsonFormat(mockSupplier, mockLines);
			expect(result).toBe(expected);
		});
	});

	describe("generateStandardFormat", () => {
		it("should generate a correctly formatted Standard Fixed-Width order string", () => {
			const expected = ["0000913186978886910245500001", "0000913186978886910840200012", "0000913186978886910677400099"].join("\n");
			const result = generateStandardFormat(mockSupplier, mockLines);
			expect(result).toBe(expected);
		});
	});

	describe("generateRcsFormat", () => {
		it("should generate a correctly formatted RCS order string with 3-digit quantity", () => {
			const expected = ["00009131869788869102455001", "00009131869788869108402012", "00009131869788869106774099"].join("\n");
			const result = generateRcsFormat(mockSupplier, mockLines, 3);
			expect(result).toBe(expected);
		});

		it("should generate a correctly formatted RCS order string with 5-digit quantity", () => {
			const expected = ["0000913186978886910245500001", "0000913186978886910840200012", "0000913186978886910677400099"].join("\n");
			const result = generateRcsFormat(mockSupplier, mockLines, 5);
			expect(result).toBe(expected);
		});
	});

	describe("generateLoescherFormat", () => {
		it("should generate a correctly formatted Loescher order string with 3-digit quantity", () => {
			const expected = ["9131869788869102455001", "9131869788869108402012", "9131869788869106774099"].join("\n");
			const result = generateLoescherFormat(mockSupplier, mockLines, 3);
			expect(result).toBe(expected);
		});

		it("should generate a correctly formatted Loescher order string with 5-digit quantity", () => {
			const expected = ["913186978886910245500001", "913186978886910840200012", "913186978886910677400099"].join("\n");
			const result = generateLoescherFormat(mockSupplier, mockLines, 5);
			expect(result).toBe(expected);
		});
	});
});
