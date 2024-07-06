import { distinctUntilChanged, firstValueFrom, Observable, Subject, Subscription } from "rxjs";

import type { VolumeStock } from "@librocco/shared";

import { VersionedString, VersionString } from "../types";

const compareCustomItems = (a: VolumeStock, b: VolumeStock) =>
	!(isCustomItemRow(a) && isCustomItemRow(b))
		? // This comparison is applicable only if both items are custom items,
		  // If not, the comparison is inconclusive
		  0
		: a.id < b.id
		? -1
		: a.id > b.id
		? 1
		: 0;

const compareBookRows = (a: VolumeStock, b: VolumeStock) =>
	!(isBookRow(a) && isBookRow(b))
		? // This comparison is applicable only if both items are book items,
		  // If not, the comparison is inconclusive
		  0
		: a.isbn < b.isbn
		? -1
		: a.isbn > b.isbn
		? 1
		: a.warehouseId < b.warehouseId || a.warehouseId === ""
		? -1
		: 1;

export const sortBooks = (a: VolumeStock, b: VolumeStock) =>
	compareCustomItems(a, b) || compareBookRows(a, b) || (isCustomItemRow(a) ? 1 : -1);

/** Replaces JS friendly version name ('version_1_1') with a human friendly version name ('version 1.1') */
export const processVersionName = (s: string): string => s.replace("_", " ").replace("_", ".");

/** Replaces JS friendly test function name ('commitNotes') with a human friendly test name ('commit notes') */
export const processTestName = (s: string): string => s.replaceAll(/([A-Z]|[0-9]+)/g, (c) => " " + c.toLowerCase());

/**
 * Returns a timestamp (UNIX millis), hashed to base 36. Used for generating or accessing note ids.
 * @param {Date} [date] optional date to hash, defaults to current date
 *
 * @example
 * ```ts
 * // We want to get all notes for wh1 starting from "2024-01-01"
 * import PouchDB from "pouchdb";
 * const startkey = versionId(`${warehouseId}/notes/${getHashedTimestamp(new Date("2024-01-01"))}`);
 * const notes = await new PouchDB("db-name").allDocs({ startkey })
 * ```
 */
export const getHashedTimestamp = (date = new Date()) => date.getTime().toString(36);

/**
 * A util used to generate a timestamped unique string.
 * - starts by UNIX timestamp converted to hex for brevity
 * - adds two character hex order
 * - finishes with random 2-character hex
 * @param {number} [i] ordering index to append after the timestamp, in case we have a lot of entries and
 * @param {Date} [date] this will mostly be used for tests as, in production, we want to use the current date/time
 * wish to order them regardless of them, possibly, receiving the same UNIX timestamp
 * @returns a semi-unique string generated from timestamp, so the results can be sorted chronologically.
 */
export const uniqueTimestamp = (i = 0, date = new Date()) => {
	// Get hashed timestamp (for brevity)
	const hashedTimestmap = getHashedTimestamp(date);

	// Create a standardised (2 character) order number
	// Able to represent 1296 numbers and it's safe to assume no more
	// then that will be processed under the same timestamp (in single millisecond)
	const iStr = (i % 1296).toString(36);
	const index = ["0".repeat(2 - iStr.length), iStr].join("");

	// Additional two characters for uniqueness buffer
	const additional = Math.floor(Math.random() * 1296).toString(36);

	return [hashedTimestmap, index, additional].join("");
};

/**
 * Unpacks the unique timestamped id (of a note) and extracts the date the note was created
 * it accepts both note id (as a unique timestmap) as well as the full note _id - "/" separated namespaced path ending with unique timestamp
 */
export const getCreatedAt = (id: string): Date => new Date(parseInt(id.split("/").pop()!.slice(0, 8), 36));

export const runAfterCondition = async <R>(cb: () => Promise<R>, condition: Observable<boolean>): Promise<R> => {
	// Create a stream to emit the result of the 'cb' function
	// thus resolving this function as with the result of the 'cb'
	const resultStream = new Subject<R>();

	let timeout: NodeJS.Timeout | null = null;
	let subscription: Subscription | null = null;

	// Cue the 'cb' function to run as soon as the condition is met/resolved
	subscription = condition
		// We wish to prevent the subscription callback run on the same value multiple times.
		//
		// distinctUntilChanged() will turn this stream:
		// |-false--false--false--true--true-->
		// into:
		// |-false----------------true-------->
		.pipe(distinctUntilChanged())
		.subscribe((ready) => {
			// The condition is met, cancel the timeout and run the 'cb' function
			if (ready) {
				if (timeout) {
					clearTimeout(timeout);
				}
				// Unsubscribe from the condition stream as we need to run the 'cb' function only once.
				if (subscription) {
					subscription.unsubscribe();
				}
				cb().then((result) => {
					// Stream the result of the 'cb' function to the result stream
					// thus resolving the promise returned by this function
					resultStream.next(result);
				});
			} else {
				// If the condition is not met after 2 seconds, stop the execution and throw an error.
				// There can be only one timeout as we wish the function to timeout from the first run.
				if (!timeout) {
					timeout = setTimeout(() => {
						subscription?.unsubscribe();
						throw new Error("Error performing 'runWithcondition': Timed out");
					}, 5000);
				}
			}
		});

	// Return a promise from result stream, eventually resolving to the result of the 'cb' function
	return firstValueFrom(resultStream);
};

/**
 * A HOF used to create a versioning function for document ids.
 * It accepts a version string (e.g. `"v1"`) and returns a function which:
 * - takes in a document id,
 * - checks if the id is versioned
 * - if it's not versioned, prepends it with version string, e.g. `"doc-id"` -> `"v1/doc-id"`
 * @param version
 * @returns
 */
export const createVersioningFunction =
	(version: VersionString) =>
	(id: string): VersionedString =>
		isVersioned(id, version) ? id : `${version}/${id}`;

/**
 * Returns true if the id is a versioned string.
 */
export const isVersioned = (id: string, versionString: VersionString): id is VersionedString => id.startsWith(`${versionString}/`);

/** Is empty is a helper function, checking for an object being defined, but empty (`{}`) */
export const isEmpty = (obj: Record<string, unknown>): boolean => Object.keys(obj).length === 0;

/** Checks if item is custom item row */
export function isCustomItemRow<T extends VolumeStock>(item: T): item is Extract<T, VolumeStock<"custom">> {
	return item.__kind === "custom";
}

/** Checks if item is book row */
export function isBookRow<T extends VolumeStock>(item: T): item is Extract<T, VolumeStock<"book">> {
	return item.__kind !== "custom";
}
