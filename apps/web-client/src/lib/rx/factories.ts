import type { BehaviorSubject, Observable } from 'rxjs';
import { map, combineLatestWith } from 'rxjs/operators';

import type { VolumeQuantity } from '$lib/types/db';
import type { BookStore } from '$lib/types/inventory';

import { getPaginationData, getTableEntries } from './selectors';

// table_content as "Rx factories"
// leveraging table_content "selectors"

// TODO: Add JSDOC comments to each of these

export const createEntriesStream = (
	entriesStream: Observable<VolumeQuantity[]>,
	currentPageStream: BehaviorSubject<number>,
	bookStockStream: Observable<BookStore>
) => {
	return entriesStream.pipe(
		combineLatestWith(currentPageStream, bookStockStream),
		map(([entries, currentPage, bookStock]) => getTableEntries(entries, currentPage, bookStock))
	);
};

export const createPaginationStream = (
	entriesStream: Observable<VolumeQuantity[]>,
	currentPageStream: BehaviorSubject<number>
) => {
	return entriesStream.pipe(
		combineLatestWith(currentPageStream),
		map(([entries, currentPage]) => getPaginationData(entries, currentPage))
	);
};
