import { DesignDocument } from '@/types';
import { DatabaseInterface, WarehouseInterface } from './types';

import { newWarehouse } from './warehouse';

class Database implements DatabaseInterface {
	_pouch: PouchDB.Database;

	constructor(db: PouchDB.Database) {
		this._pouch = db;
	}

	warehouse(name = 'default'): WarehouseInterface {
		return newWarehouse(this, name);
	}
	updateDesignDoc(doc: DesignDocument) {
		return this._pouch.put(doc);
	}
	destroy() {
		return this._pouch.destroy();
	}
}

export const newDatabase = (db: PouchDB.Database): Database => {
	return new Database(db);
};
// #region Database
