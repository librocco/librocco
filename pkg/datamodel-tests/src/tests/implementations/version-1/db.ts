import { DatabaseInterface } from './types';

import { newWarehouse } from './warehouse';

class Database implements DatabaseInterface {
	#db: PouchDB.Database;

	constructor(db: PouchDB.Database) {
		this.#db = db;
	}

	createWarehouse(name: string) {
		return newWarehouse(this.#db, name);
	}
	destroy() {
		return this.#db.destroy();
	}
}

export const newDatabase = (db: PouchDB.Database): Database => {
	return new Database(db);
};
// #region Database
