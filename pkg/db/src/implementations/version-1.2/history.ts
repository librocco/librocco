import { BehaviorSubject, Observable, map, share, tap } from "rxjs";

import { wrapIter, debug } from "@librocco/shared";

import { HistoryInterface, MapReduceRow } from "@/types";
import { InventoryDatabaseInterface, NoteData } from "./types";

import { PastTransactions } from "./past-transactions";

class HistoryProvider implements HistoryInterface {
	#db: InventoryDatabaseInterface;
	#stream: Observable<PastTransactions>;

	constructor(db: InventoryDatabaseInterface) {
		this.#db = db;

		const cache = new BehaviorSubject<PastTransactions>(new PastTransactions([]));
		this.#stream = this.#db
			.view<MapReduceRow<string>, NoteData>("v1_list/committed")
			.stream({}, { include_docs: true })
			.pipe(
				map(({ rows }) => {
					const notes = wrapIter(rows)
						.map(({ doc }) => doc)
						.filter((doc): doc is NoteData => Boolean(doc));
					return PastTransactions.fromNotes(notes);
				}),
				share({ connector: () => cache, resetOnRefCountZero: false })
			);
	}

	stream(ctx: debug.DebugCtx): Observable<PastTransactions> {
		return this.#stream.pipe(tap(debug.log(ctx, "history:past_transactions")));
	}
}

export const newHistoryProvider = (db: InventoryDatabaseInterface) => new HistoryProvider(db);
