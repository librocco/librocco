import { wrapIter, type VolumeStock } from "@librocco/shared";

import type { PastTransaction, PastTransactionsMap, NoteData } from "@/types";
import { isBookRow } from "@/utils/misc";

export class PastTransactions {
	private _internal: Iterable<PastTransaction>;

	constructor(list: Iterable<PastTransaction>) {
		this._internal = list;
	}

	public static fromNotes(notes: Iterable<Pick<NoteData, "_id" | "committed" | "noteType" | "updatedAt"> & { entries: VolumeStock[] }>) {
		const entries = wrapIter(notes)
			.filter(({ committed }) => committed)
			.flatMap(({ _id, entries, updatedAt, noteType }) =>
				wrapIter(entries)
					.filter(isBookRow)
					.map((e) => ({ ...e, noteId: _id, date: updatedAt!.slice(0, 10), noteType }))
			);
		return new PastTransactions(entries);
	}

	public by(property: keyof PastTransaction): PastTransactionsMap {
		return wrapIter(this._internal)._groupIntoMap((e) => [e[property] as string, e]);
	}
}
