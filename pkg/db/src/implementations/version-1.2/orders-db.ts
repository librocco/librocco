/* eslint-disable @typescript-eslint/no-explicit-any */

import { BooksInterface, DesignDocument, Replicator, PluginInterfaceLookup, LibroccoPlugin, CustomerOrderInterface } from "@/types";
import { OrdersDatabaseInterface } from "./types";

import { orders as designDocs } from "./designDocuments";

import { newBooksInterface } from "./books";
import { newDbReplicator } from "./replicator";
import { newPluginsInterface, PluginsInterface } from "./plugins";
import { newCustomerOrder } from "./customer-order";

class Database implements OrdersDatabaseInterface {
	_pouch: PouchDB.Database;

	#booksInterface?: BooksInterface;

	#plugins: PluginsInterface;

	constructor(db: PouchDB.Database) {
		this._pouch = db;

		this.#plugins = newPluginsInterface();

		return this;
	}

	// #region setup
	replicate(): Replicator {
		return newDbReplicator(this);
	}

	async buildIndices() {
		// NOOP for now
	}

	plugin<T extends keyof PluginInterfaceLookup>(type: T): LibroccoPlugin<PluginInterfaceLookup[T]> {
		return this.#plugins.get(type);
	}

	async init(): Promise<OrdersDatabaseInterface> {
		// Start initialisation with db setup:
		// - update design documents
		const dbSetup: Promise<any>[] = [];

		// Upload design documents if any
		if (designDocs.length) {
			designDocs.forEach((dd) => {
				dbSetup.push(this.updateDesignDoc(dd));
			});
		}

		await Promise.all(dbSetup);
		return this;
	}

	updateDesignDoc(doc: DesignDocument) {
		return this._pouch.put(doc).catch((err) => {
			// If error is not a conflict, throw it back
			if (err.status != 409) {
				throw err;
			}
			// If the error was a conflict (document exists), update the document
			return this._pouch.get(doc._id).then(({ _rev }) => this._pouch.put({ ...doc, _rev }));
		});
	}
	// #endregion setup

	// #region instances
	books(): BooksInterface {
		// We're caching the books interface to avoid creating multiple instances
		return this.#booksInterface ?? (this.#booksInterface = newBooksInterface(this));
	}

	/**
	 * Instantiate a new customer order instance, with the provided id.
	1. db.customerorder()
	2. db.customerorder("order-1")
	3. db.customerorder("order-1").create()
	 */
	customerOrder(id?: string): CustomerOrderInterface {
		return newCustomerOrder(this, id);
	}
	// #endregion instances
}

export const newDatabase = (db: PouchDB.Database): OrdersDatabaseInterface => {
	return new Database(db);
};
