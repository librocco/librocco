import { wrapIter, type VolumeStock } from "@librocco/shared";

import type { PastTransaction, PastTransactionsMap, NoteData, PastTransactionsInterface } from "@/types";

import { isBookRow } from "@/utils/misc";

export class PastTransactions implements PastTransactionsInterface {
	private _internal: Iterable<PastTransaction>;

	constructor(list: Iterable<PastTransaction>) {
		this._internal = list;
	}

	public static fromNotes(
		notes: Iterable<
			Pick<NoteData, "id" | "committed" | "noteType" | "updatedAt" | "committedAt" | "displayName"> & { entries: VolumeStock[] }
		>
	) {
		const entries = wrapIter(notes)
			.filter(({ committed }) => committed)
			.flatMap(({ id, entries, committedAt, updatedAt, noteType, displayName: noteDisplayName }) =>
				wrapIter(entries)
					.filter(isBookRow)
					.map((e) => ({ ...e, noteId: id, date: committedAt || updatedAt!, noteType, noteDisplayName }))
			);
		return new PastTransactions(entries);
	}

	public by(property: keyof PastTransaction): PastTransactionsMap {
		// The date will, in most cases, include the time of day.
		// When grouping by date, we're interested only in the date part
		if (property === "date") {
			return wrapIter(this._internal)._groupIntoMap((e) => [e["date"].slice(0, 10), e]);
		}
		return wrapIter(this._internal)._groupIntoMap((e) => [e[property] as string, e]);
	}
}
