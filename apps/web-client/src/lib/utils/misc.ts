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
