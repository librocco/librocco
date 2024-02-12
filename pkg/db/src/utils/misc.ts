import { distinctUntilChanged, firstValueFrom, Observable, Subject, Subscription } from "rxjs";

import type { VolumeStock } from "@librocco/shared";

import { VersionedString, VersionString } from "../types";

export const sortBooks = ({ isbn: i1, warehouseId: w1 }: VolumeStock, { isbn: i2, warehouseId: w2 }: VolumeStock) =>
	i1 < i2 ? -1 : i1 > i2 ? 1 : w1 < w2 ? -1 : 1;

/** Replaces JS friendly version name ('version_1_1') with a human friendly version name ('version 1.1') */
export const processVersionName = (s: string): string => s.replace("_", " ").replace("_", ".");

/** Replaces JS friendly test function name ('commitNotes') with a human friendly test name ('commit notes') */
export const processTestName = (s: string): string => s.replaceAll(/([A-Z]|[0-9]+)/g, (c) => " " + c.toLowerCase());

/**
 * A util used to generate a timestamped unique string.
 * - starts by UNIX timestamp converted to hex for brevity
 * - adds two character hex order
 * - finishes with random 2-character hex
 * @param {number} [i] ordering index to append after the timestamp, in case we have a lot of entries and
 * wish to order them regardless of them, possibly, receiving the same UNIX timestamp
 * @returns a semi-unique string generated from timestamp, so the results can be sorted chronologically.
 */
export const uniqueTimestamp = (i = 0) => {
	// Get hex timestamp (for brevity)
	const millis = Date.now();
	const hexTimestamp = millis.toString(36);

	// Create a standardised (2 character) order number
	// Able to represent 1296 numbers and it's safe to assume no more
	// then that will be processed under the same timestamp (in single millisecond)
	const iStr = (i % 1296).toString(36);
	const index = ["0".repeat(2 - iStr.length), iStr].join("");

	// Additional two characters for uniqueness buffer
	const additional = Math.floor(Math.random() * 1296).toString(36);

	return [hexTimestamp, index, additional].join("");
};

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
