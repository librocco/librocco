import { switchMap, combineLatest } from "rxjs";

import type { CreateHistoryStore, Result } from "$lib/types/inventory";
import { observableFromStore, readableFromStream } from "$lib/utils/streams";
import { mapMergeBookWarehouseData } from "$lib/utils/misc";

export const createHistoryStore: CreateHistoryStore = (ctx, db, committedNotesListStream, warehouseListStream, dateValue) => {
	const searchResStream = combineLatest([committedNotesListStream, observableFromStore(dateValue)]).pipe(
		switchMap(([notes, date]) => {
			const entries = notes.get(date.toString().slice(0, 10)) || [];

			const isbns = entries.map((match) => match.isbn);

			return db
				?.books()
				.stream(ctx, isbns)
				.pipe((bookObs) => mapMergeBookWarehouseData(ctx, entries, warehouseListStream)(bookObs));
		})
	);
	return {
		result: readableFromStream(ctx, searchResStream, {} as Result)
	};
};
