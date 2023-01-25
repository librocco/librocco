import { type BehaviorSubject, type Observable, from, EMPTY } from 'rxjs';
import { map, combineLatestWith, switchMap } from 'rxjs/operators';

import type { VolumeQuantity } from '$lib/types/db';
import type { BookStore, NoteEntry, WarehouseEntry } from '$lib/types/inventory';

import { getPaginationData, getTableEntries } from './selectors';
import type { NoteTempState } from '$lib/enums/inventory';

// table_content as "Rx factories"
// leveraging table_content "selectors"

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

export const createDisplayNameStream = (
	entityStream: Observable<WarehouseEntry | NoteEntry>,
	localNameStream: Observable<string>,
	pageIdStream: Observable<string>
) => {
	return entityStream.pipe(
		combineLatestWith(localNameStream, pageIdStream),
		map(([entity, localName, id]) => {
			const name = localName ? localName : entity?.displayName || id;
			return name as string;
		})
	);
};

export const createNoteStateStream = (
	noteStream: Observable<NoteEntry>,
	localNoteStateStream: Observable<NoteTempState | null>
) => {
	return noteStream.pipe(
		combineLatestWith(localNoteStateStream),
		map(([note, localState]) => {
			const state = localState ? localState : note?.state;
			return state;
		})
	);
};

export const createDbUpdateStream = (
	localValueStream: Observable<any>,
	dbUpdatePromise: (value: any) => Promise<void>
) => {
	return localValueStream.pipe(
		switchMap((value) => {
			if (!value) {
				return EMPTY;
			} else {
				const promise = dbUpdatePromise(value);
				return from(promise);
			}
		})
	);
};
