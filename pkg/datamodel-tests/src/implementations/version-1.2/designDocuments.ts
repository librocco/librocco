import { DesignDocument, CouchDocument } from '@/types';

const warehouseStockDocument: DesignDocument = {
	_id: '_design/stock',
	views: {
		by_warehouse: {
			map: function (doc: CouchDocument) {
				const [note, isbn] = doc._id.slice(1).split('/');
				if (isbn) {
					const [nType] = note.split('-');
					const delta = nType == 'inbound' ? doc.quantity : -doc.quantity;
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
