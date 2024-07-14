/* eslint-disable @typescript-eslint/no-unused-vars */
import { BookEntry, DesignDocument } from "@/types";
import { WarehouseData, NoteData } from "./types";

const sequenceNamingDesignDocument: DesignDocument = {
	_id: "_design/v1_sequence",
	views: {
		warehouse: {
			map: function (doc: WarehouseData) {
				const { displayName } = doc as WarehouseData | NoteData;

				if (doc.docType === "warehouse" && /^New Warehouse( \([0-9]+\))?$/.test(displayName)) {
					const match = /[0-9]+/.test(displayName) && displayName.match(/[0-9]+/);
					if (match) {
						emit(doc._id, parseInt(match[0]));
					} else {
						emit(doc._id, 1);
					}
				}
			}.toString(),
			reduce: `_stats`
		},
		note: {
			map: function (doc: NoteData) {
				const { displayName } = doc as NoteData;

				if (doc.docType === "note" && /^New Note( \([0-9]+\))?$/.test(displayName)) {
					const match = /[0-9]+/.test(displayName) && displayName.match(/[0-9]+/);
					if (match) {
						emit(doc._id, parseInt(match[0]));
					} else {
						emit(doc._id, 1);
					}
				}
			}.toString(),
			reduce: `_stats`
		},
		"customer-order": {
			map: function (doc: NoteData) {
				const { displayName } = doc as NoteData;

				if (doc.docType === "customer_order") {
					const match = /[0-9]+/.test(displayName) && displayName.match(/[0-9]+/);
					if (match) {
						emit(doc._id, parseInt(match[0]));
					}
				}
			}.toString(),
			reduce: `_stats`
		}
	}
};

export const listDeisgnDocument: DesignDocument = {
	_id: "_design/v1_list",
	views: {
		warehouses: {
			map: function (doc: WarehouseData | NoteData) {
				if (doc.docType === "warehouse") {
					emit(doc._id, { displayName: doc.displayName, discountPercentage: (doc as WarehouseData).discountPercentage });
				}
			}.toString()
		},
		outbound: {
			map: function (doc: NoteData | WarehouseData) {
				if (doc.docType !== "note" || (doc as NoteData).noteType !== "outbound") {
					return;
				}

				const note = doc as NoteData;

				emit(doc._id, {
					displayName: doc.displayName,
					committed: note.committed,
					updatedAt: note.updatedAt,
					totalBooks: note.entries.length
				});
			}.toString()
		},
		inbound: {
			map: function (doc: NoteData | WarehouseData) {
				if (doc.docType === "warehouse") {
					emit(doc._id, { type: doc.docType, displayName: doc.displayName });
					return;
				}

				const note = doc as NoteData;
				if (note.docType !== "note" || note.noteType !== "inbound") {
					return;
				}

				emit(doc._id, {
					type: doc.docType,
					displayName: doc.displayName,
					committed: note.committed,
					updatedAt: note.updatedAt,
					totalBooks: note.entries.length
				});
			}.toString()
		},
		committed: {
			map: function (doc: NoteData) {
				const note = doc as NoteData;
				if (note.docType !== "note" || !note.committed || !note.entries.length || !note.updatedAt) {
					return;
				}

				emit(doc._id);
			}.toString()
		},
		publishers: {
			// Since we're only interested in 'publisher' property on book documents
			// we can treat all docs as book documents and only emit if the property exists
			map: function (doc: BookEntry) {
				if (doc.publisher) {
					emit(doc.publisher);
				}
			}.toString(),
			reduce: "_count"
		}
	}
};

/**
 * Creates a stock design document view for the specific month. It captures all changes to stock after that month (for running changes and so)
 */
const createRunningStockLogic = (month: string): DesignDocument["views"][string] => {
	const x = {
		map: function (doc: WarehouseData | NoteData) {
			const month = "%month%";
			if (doc.docType !== "note") {
				return;
			}

			const { entries, committedAt, noteType } = doc as NoteData;

			// Check if note is applicable for the given month
			// Note: Any time after the month start is applicable, as it might happen that the
			// archive is stale (e.g. two, three months ago, so we need to capture all of the running stock)
			if (!entries || !committedAt || committedAt < month) {
				return;
			}

			entries.forEach((entry) => {
				// Only book transactions are accounted for in stock
				if (entry.__kind !== "custom") {
					// Check if we should be incrementing or decrementing the overall quantity
					const delta = noteType === "inbound" ? entry.quantity : -entry.quantity;

					emit([entry.warehouseId, entry.isbn], delta);
				}
			});
		}
			.toString()
			.replace(/%month%/g, `${month}`),
		reduce: "_sum"
	};
	console.log(x);
	return x;
};

/** Create a new stock design document with the single view - current month */
export const createStockDesignDocument = (month: string): DesignDocument => ({
	_id: "_design/v1_stock",
	views: {
		[month]: createRunningStockLogic(month)
	}
});

/**
 * Updates the existing stock design document by adding a new view for the given month. It's safe to keep previous months as views, even though they, in theory,
 * listen to all updates, my understanding is that the view won't be recalculated until it's queries, so, as long as we query only the latest, the previous ones
 * aren't much of a liability.
 */
export const updateStockDesignDocument =
	(month: string) =>
	(prev: DesignDocument): DesignDocument => ({
		...prev,
		views: {
			...prev.views,
			[month]: createRunningStockLogic(month)
		}
	});

export const inventory = [listDeisgnDocument, sequenceNamingDesignDocument];
export const orders = [listDeisgnDocument, sequenceNamingDesignDocument];
