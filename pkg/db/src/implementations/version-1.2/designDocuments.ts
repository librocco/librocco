/* eslint-disable @typescript-eslint/no-unused-vars */
import { BookEntry } from "@/types";
import { WarehouseData, NoteData, DesignDocument } from "./types";

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

const notes: DesignDocument = {
	_id: "_design/v1_notes",
	views: {
		by_id: {
			map: function (doc: WarehouseData) {
				if (doc.docType === "note") {
					emit(doc.id, doc._id);
				}
			}.toString()
		}
	}
};

export const inventory = [listDeisgnDocument, sequenceNamingDesignDocument, notes];
export const orders = [listDeisgnDocument, sequenceNamingDesignDocument];
