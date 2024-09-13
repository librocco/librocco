import { map } from "rxjs";

import { VolumeStock, wrapIter, debug } from "@librocco/shared";

import { HistoryInterface, NoteType, PastTransaction } from "@/types";
import { InventoryDatabaseInterface } from "./types";

class History implements HistoryInterface {
	#db: InventoryDatabaseInterface;

	constructor(db: InventoryDatabaseInterface) {
		this.#db = db;
	}

	stream(ctx: debug.DebugCtx = {}) {
		return this.#db
			._stream(ctx, (db) =>
				db
					.selectFrom("notes as n")
					.innerJoin("bookTransactions as t", "n.id", "t.noteId")
					.where("n.committed", "==", 1)
					.select([
						"t.isbn",
						"t.warehouseId",
						"t.quantity",
						"n.id as noteId",
						"n.displayName as noteDisplayName",
						"n.noteType",
						"n.createdAt",
						"n.updatedAt",
						"n.committedAt"
					])
					.orderBy("n.committedAt", "asc")
			)
			.pipe(map(newPastTransactionsMap));
	}
}

const newPastTransactionsMap = (
	rows: Array<
		VolumeStock<"book"> & {
			noteId: string;
			noteType: string;
			noteDisplayName: string;
			createdAt: string;
			updatedAt?: string | null;
			committedAt?: string | null;
		}
	>
) => {
	const internal = rows.map(({ createdAt, updatedAt, committedAt, noteType, ...row }) => ({
		...row,
		noteType: noteType as NoteType,
		// In practice this should always be 'committedAt', but we're doing this to keep TS happy,
		// and for backwards compatibility
		date: (committedAt ?? updatedAt ?? createdAt).slice(0, 10)
	}));
	return {
		by(key: keyof PastTransaction) {
			return wrapIter(internal)._groupIntoMap((entry) => [entry[key] as string, entry]);
		}
	};
};

export const createHistoryInterface = (db: InventoryDatabaseInterface): HistoryInterface => new History(db);
