import type { BookData, BookFetchResultEntry } from "@librocco/shared";
type CustomerOrderLineSelection = {
	isbn: string;
	quantity: number;
};
// #region book data fetching
/**
 * Merges book data for the same book retrieved from multiple sources
 * @param sources
 * @param kind "prefer_first" - values from the source that comes first in the array will be preferred and vice versa
 * @returns
 */
export const mergeBookData = (
	seed: BookData,
	sources: BookFetchResultEntry[],
	kind: "prefer_first" | "prefer_last" = "prefer_first"
): BookData | undefined =>
	!sources.some(Boolean)
		? undefined
		: kind === "prefer_first"
			? sources.filter(Boolean).reduceRight((acc, curr) => ({ ...acc, ...curr }), seed)
			: sources.filter(Boolean).reduce((acc, curr) => ({ ...acc, ...curr }), seed);

/** A helper used to extract ONLY book data from the encompasing structure */
export const extractBookData = <T extends BookData>(entry: T): BookData => ({
	isbn: entry.isbn,
	title: entry.title,
	authors: entry.authors,
	publisher: entry.publisher,
	price: entry.price,
	year: entry.year,
	category: entry.category,
	editedBy: entry.editedBy,
	outOfPrint: entry.outOfPrint
});

export function normalizeName(name: string) {
	// Remove commas and extra spaces, then sort name parts alphabetically
	return name
		.replace(/,/g, "") // Remove commas
		.split(/\s+/) // Split on whitespace
		.sort() // Sort parts alphabetically
		.join(" ") // Rejoin with single spaces
		.trim();
}

export function matchesName(needle: string, haystack: string) {
	// Helper to normalize and tokenize the needle string into conditions
	const getConditions = (str: string) => {
		return str
			.toLowerCase()
			.replace(/[^\w\s]/g, " ") // Replace punctuation with a space
			.replace(/\s+/g, " ") // Collapse multiple spaces into one
			.trim()
			.split(" ")
			.filter((part) => part.length > 0); // Remove any empty parts resulting from normalization
	};

	const needleConditions = getConditions(needle);

	// If after normalization the needle has no conditions (e.g., needle was empty or just punctuation)
	if (needleConditions.length === 0) {
		return needle.trim().length === 0;
	}

	// Normalize the haystack for checking (lowercase and standardize punctuation/spacing)
	// This ensures "O'Malley" in haystack can match "OMalley" or "O Malley" from needle.
	const normalizedHaystack = haystack
		.toLowerCase()
		.replace(/[^\w\s]/g, " ") // Replace punctuation with a space
		.replace(/\s+/g, " ") // Collapse multiple spaces
		.trim();

	// Check if all conditions derived from the needle are present in the normalized haystack
	return needleConditions.every((condition) => normalizedHaystack.includes(condition));
}

/**
 * Generates an order file string for Format A (Pearson/PBM).
 */
export function generatePearsonFormat(customerId: number, lines: CustomerOrderLineSelection[]): string {
	return lines.map((line) => formatLine(customerId, line.isbn, line.quantity, 10, 5, "LL")).join("\n");
}

/**
 * Generates an order file string for Format B (Standard Fixed-Width).
 */
export function generateStandardFormat(customerId: number, lines: CustomerOrderLineSelection[]): string {
	return lines.map((line) => formatLine(customerId, line.isbn, line.quantity, 10, 5)).join("\n");
}

/**
 * Generates an order file string for Format C (RCS/Rizzoli).
 */
export function generateRcsFormat(customerId: number, lines: CustomerOrderLineSelection[], quantityLength: 3 | 5): string {
	return lines.map((line) => formatLine(customerId, line.isbn, line.quantity, 10, quantityLength)).join("\n");
}

/**
 * Generates an order file string for Format D (Loescher).
 */
export function generateLoescherFormat(customerId: number, lines: CustomerOrderLineSelection[], quantityLength: 3 | 5): string {
	return lines.map((line) => formatLine(customerId, line.isbn, line.quantity, 6, quantityLength)).join("\n");
}

export function downloadAsTextFile(content: string, filename: string) {
	const blob = new Blob([content], { type: "text/plain" });
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");

	a.href = url;
	a.download = filename;
	document.body.appendChild(a);
	a.click();

	document.body.removeChild(a);
	URL.revokeObjectURL(url);
}
function formatLine(cust: number, isbn: string, quantity: number, custLength: number, quantityLength: number, suffix = ""): string {
	const paddedCode = String(cust).padStart(custLength, "0");
	let digitsIsbn = isbn.replace(/-/g, "");
	if (digitsIsbn.length < 13) {
		digitsIsbn = digitsIsbn.padStart(13, "0");
	} else if (digitsIsbn.length > 13) {
		// throw error??
		return "";
	}
	const paddedQuantity = String(quantity).padStart(quantityLength, "0");
	return `${paddedCode}${digitsIsbn}${paddedQuantity}${suffix}`;
}
