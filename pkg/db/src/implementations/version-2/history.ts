import { map } from "rxjs";

import { VolumeStock, wrapIter } from "@librocco/shared";

import { HistoryInterface, NoteType, PastTransaction } from "@/types";
import { InventoryDatabaseInterface } from "./types";

import { observableFromStore } from "@/helpers";

export const createHistoryInterface = (db: InventoryDatabaseInterface): HistoryInterface => {
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
			date: committedAt ?? updatedAt ?? createdAt
		}));
		return {
			by(key: keyof PastTransaction) {
				return wrapIter(internal)._groupIntoMap((entry) => [entry[key], entry]);
			}
		};
	};

	return {
		stream() {
			return observableFromStore(
				db.replicated((db) =>
					db
						.selectFrom("notes as n")
						.innerJoin("bookTransactions as t", "n.id", "t.noteId")
						.where("n.committed", "==", true)
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
				)
			).pipe(map(newPastTransactionsMap));
		}
	} as HistoryInterface;
};
