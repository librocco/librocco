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
