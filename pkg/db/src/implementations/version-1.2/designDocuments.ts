/* eslint-disable @typescript-eslint/no-unused-vars */
import { DesignDocument } from "@/types";
import { WarehouseData, NoteData } from "./types";

const sequenceNamingDesignDocument: DesignDocument = {
	_id: "_design/v1_sequence",
	views: {
		warehouse: {
			map: function (doc: WarehouseData) {
				const { displayName } = doc as NoteData;

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
		}
	}
};

const stockDesignDocument: DesignDocument = {
	_id: "_design/v1_stock",
	views: {
		by_isbn: {
			map: function (doc: WarehouseData | NoteData) {
				const { entries, committed } = doc as NoteData;

				// Account for book transactions only if the note is committed
				if (doc.docType === "note" && entries && committed) {
					entries.forEach((entry) => {
						// Check if we should be incrementing or decrementing the overall quantity
						const delta = (doc as NoteData).noteType === "inbound" ? entry.quantity : -entry.quantity;

						emit([entry.isbn, entry.warehouseId], delta);
					});
				}
			}.toString(),
			reduce: "_sum"
		}
	}
};

export const listDeisgnDocument: DesignDocument = {
	_id: "_design/v1_list",
	views: {
		warehouses: {
			map: function (doc: WarehouseData | NoteData) {
				if (doc.docType === "warehouse") {
					emit(doc._id, { displayName: doc.displayName });
				}
			}.toString()
		},
		outbound: {
			map: function (doc: NoteData | WarehouseData) {
				if (doc.docType !== "note" || (doc as NoteData).noteType !== "outbound") {
					return;
				}

				const note = doc as NoteData;

				emit(doc._id, { displayName: doc.displayName, committed: note.committed });
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

				emit(doc._id, { type: doc.docType, displayName: doc.displayName, committed: note.committed });
			}.toString()
		}
	}
};

export default [stockDesignDocument, listDeisgnDocument, sequenceNamingDesignDocument];