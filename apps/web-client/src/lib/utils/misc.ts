import type { BookData, BookFetchResultEntry } from "@librocco/shared";

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

export async function retry<R>(cb: () => Promise<R>, pause: number, retries: number): Promise<R> {
	// Attempt the first time + n - 1 retries
	for (let i = 0; i < retries; i++) {
		try {
			return await cb();
		} catch {
			await new Promise((res) => setTimeout(res, pause));
		}
	}

	// On the last retry, execute the function come-what-may
	return await cb();
}
