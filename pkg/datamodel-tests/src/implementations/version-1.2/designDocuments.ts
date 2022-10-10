/* eslint-disable @typescript-eslint/no-unused-vars */
import { DesignDocument, CouchDocument } from '@/types';

const warehouseStockDocument: DesignDocument = {
	_id: '_design/warehouse',
	views: {
		notes: {
			map: function (doc: CouchDocument) {
				if (doc.type && ['inbound', 'outbound'].includes(doc.type)) {
					const [warehouse] = doc._id.split('/');
					emit(warehouse);
				}
			}.toString()
		},
		stock: {
			map: function (doc: CouchDocument) {
				// Full transaction doc id would look something like this
				// <warehouse>/<note_type>/<note_timestamp>/<isbn>/<transaction_timestamp>
				const [_w, noteType, _d, isbn] = doc._id.split('/');
				if (doc.isbn && doc.committed) {
					const delta = noteType == 'inbound' ? doc.quantity : -doc.quantity;
					// We wish our entries to be sorted by warehouse and then by isbn with delta as value
					emit([doc.warehouse, isbn], delta);
				}
			}.toString()
		}
	}
};

/**
 * A row in `_design/stock/_view/by_warehouse` query reponse.
 * The rows are sorted by warehouse and isbn. There might be multiple entries
 * for each [warehouse, isbn] pair so the results should be aggregated to show real quantity.
 *
 * @TODO the results should probably be aggregated using the reduce function on the design document itself
 * rether than in code.
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

export default [warehouseStockDocument];
