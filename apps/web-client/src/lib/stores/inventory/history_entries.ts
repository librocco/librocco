import { switchMap, combineLatest } from "rxjs";
import { readable, type Readable } from "svelte/store";
import type { DateValue } from "@internationalized/date";

import type { debug } from "@librocco/shared";
import type { InventoryDatabaseInterface } from "@librocco/db";

import type { DailySummaryStore } from "$lib/types/inventory";
import { observableFromStore, readableFromStream } from "$lib/utils/streams";
import { mapMergeBookWarehouseData } from "$lib/utils/misc";

export interface CreateHistoryStore {
	(ctx: debug.DebugCtx, db: InventoryDatabaseInterface | undefined, dateValue: Readable<DateValue>): Readable<DailySummaryStore>;
}

export const createDailySummaryStore: CreateHistoryStore = (ctx, db, dateValue) => {
	if (!db) {
		return readable({} as DailySummaryStore);
	}

	const pastTransactionsStream = db.stream().pastTransactions(ctx);
	const warehouseMapStream = db.stream().warehouseMap(ctx);

	const dailySummary = combineLatest([pastTransactionsStream, observableFromStore(dateValue)]).pipe(
		switchMap(([txnMap, date]) => {
			const entries = [...(txnMap.get(date.toString().slice(0, 10)) || [])];

			const isbns = entries.map(({ isbn }) => isbn);

			return db.books().stream(ctx, isbns).pipe(mapMergeBookWarehouseData(ctx, entries, warehouseMapStream));
		})
	);

	return readableFromStream(ctx, dailySummary, {} as DailySummaryStore);
};
