import { Observable, combineLatest, map } from "rxjs";

import type { BookEntry, BookFetchResultEntry, PastTransaction, WarehouseDataMap } from "@librocco/db";
import { wrapIter, debug, composeCompare, asc } from "@librocco/shared";

import type { DailySummaryStore } from "$lib/types/inventory";

/**
 * A util used to compare two paths. It trims the paths and removes the leading and trailing slashes
 * for clean comparison.
 * @example
 * ```ts
 * comparePaths("/foo/bar", "foo/bar"); // true
 * comparePaths("foo/bar", "foo/bar/"); // true
 * ```
 */
export const comparePaths = (...paths: [string, string]) => {
	const trimmed = paths.map((l) => l.trim().replace(/^\//, "").replace(/\/$/g, ""));
	return trimmed[0] === trimmed[1];
};

export const compareNotes = <N extends { updatedAt?: string | Date | null }>({ updatedAt: a }: N, { updatedAt: b }: N) => {
	if (!a) return 1;
	if (!b) return -1;

	const _a = typeof a === "string" ? a : a.toISOString();
	const _b = typeof b === "string" ? b : b.toISOString();

	return _a < _b ? 1 : -1;
};

const compareTxns = composeCompare<PastTransaction & BookEntry>(
	asc(({ date }) => date),
	asc(({ noteId }) => noteId.split("/").pop()),
	asc(({ isbn }) => isbn),
	asc(({ warehouseId }) => warehouseId)
);

export const mapMergeBookWarehouseData =
	(ctx: debug.DebugCtx, entries: Iterable<any>, warehouseListStream: Observable<WarehouseDataMap>) =>
	(books: Observable<Iterable<BookEntry | undefined>>): Observable<DailySummaryStore> =>
		combineLatest([books, warehouseListStream]).pipe(
			map(([booksData, warehouseData]) => {
				const books = wrapIter(entries)
					.zip(booksData)

					.map(([s, b = {} as BookEntry]) => {
						const warehouse = warehouseData.size ? warehouseData.get(s.warehouseId) : { displayName: "", discountPercentage: 0 };
						return {
							...s,
							...b,
							discountPercentage: warehouse.discountPercentage || 0,
							warehouseName: warehouse.displayName
						};
					})
					.array();

				return {
					bookList: books.sort(compareTxns),

					stats: books.reduce(
						(acc, { quantity, noteType, discountPercentage, price = 0 }) => {
							if (noteType === "inbound") {
								return {
									...acc,
									totalInboundBookCount: (acc.totalInboundBookCount += quantity),
									totalInboundCoverPrice: (acc.totalInboundCoverPrice += quantity * price),
									totalInboundDiscountedPrice: (acc.totalInboundDiscountedPrice += quantity * ((price * (100 - discountPercentage)) / 100))
								};
							}

							return {
								...acc,
								totalOutboundBookCount: (acc.totalOutboundBookCount += quantity),
								totalOutboundCoverPrice: (acc.totalOutboundCoverPrice += quantity * price),
								totalOutboundDiscountedPrice: (acc.totalOutboundDiscountedPrice += quantity * ((price * (100 - discountPercentage)) / 100))
							};
						},

						{
							totalInboundBookCount: 0,
							totalInboundCoverPrice: 0,
							totalOutboundBookCount: 0,
							totalOutboundCoverPrice: 0,
							totalOutboundDiscountedPrice: 0,
							totalInboundDiscountedPrice: 0
						}
					)
				};
			})
		);

// #region book data fetching
/**
 * Merges book data for the same book retrieved from multiple sources
 * @param sources
 * @param kind "prefer_first" - values from the source that comes first in the array will be preferred and vice versa
 * @returns
 */
export const mergeBookData = (sources: BookFetchResultEntry[], kind: "prefer_first" | "prefer_last" = "prefer_first") =>
	!sources.some(Boolean)
		? undefined
		: kind === "prefer_first"
		? sources.reduceRight((acc = {}, curr = {}) => ({ ...acc, ...curr }), {})
		: sources.reduce((acc = {}, curr = {}) => ({ ...acc, ...curr }), {});

// #endregion book data fetching
