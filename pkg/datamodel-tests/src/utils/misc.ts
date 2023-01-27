import { distinctUntilChanged, firstValueFrom, Observable, Subject, Subscription } from 'rxjs';

import { VolumeStock } from '@librocco/db';

export const sortBooks = ({ isbn: i1, warehouse: w1 }: VolumeStock, { isbn: i2, warehouse: w2 }: VolumeStock) =>
	i1 < i2 ? -1 : i1 > i2 ? 1 : w1 < w2 ? -1 : 1;

/** Replaces JS friendly version name ('version_1_1') with a human friendly version name ('version 1.1') */
export const processVersionName = (s: string): string => s.replace('_', ' ').replace('_', '.');

/** Replaces JS friendly test function name ('commitNotes') with a human friendly test name ('commit notes') */
export const processTestName = (s: string): string => s.replaceAll(/([A-Z]|[0-9]+)/g, (c) => ' ' + c.toLowerCase());

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
	const index = ['0'.repeat(2 - iStr.length), iStr].join('');

	// Additional two characters for uniqueness buffer
	const additional = Math.floor(Math.random() * 1296).toString(36);

	return [hexTimestamp, index, additional].join('');
};
