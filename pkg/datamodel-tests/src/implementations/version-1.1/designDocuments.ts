/* eslint-disable @typescript-eslint/no-unused-vars */
import { DesignDocument } from '@librocco/db';

import { WarehouseData, NoteData } from './types';

const warehouseDesignDocument: DesignDocument = {
	_id: '_design/warehouse',
	views: {
		stock: {
			map: function (doc: WarehouseData | NoteData) {
				const { entries, committed } = doc as NoteData;

				// Account for book transactions only if the note is committed
				if (doc.docType === 'note' && entries && committed) {
					// Note type can be inferred from the path (_id) - '<warehouse-id>/<note-type>/<note-uuid>'
					const noteType = doc._id.split('/')[1];

					entries.forEach((entry) => {
						// Check if we should be incrementing or decrementing the overall quantity
						const delta = noteType === 'inbound' ? entry.quantity : -entry.quantity;

						emit([entry.warehouse, entry.isbn], delta);
					});
				}
			}.toString(),
			reduce: '_sum'
		}
	}
};

/**
 * A row in `_design/warehouse/_view/stock` query reponse.
 * The rows are sorted by warehouse and isbn. There might be multiple entries
 * for each [warehouse, isbn] pair so the results should be aggregated to show real quantity.
 */
export type WarehouseStockEntry = {
	/**
	 * A map key in form of [warehouse, isbn]
	 */
	key: [string, string];
	/**
	 * A map value for transaction delta:
	 * - quantity increment for "inbound" transaction
	 * - quantity decrement for "outbound" transaction
	 */
	value: number;
};
export default [warehouseDesignDocument];
