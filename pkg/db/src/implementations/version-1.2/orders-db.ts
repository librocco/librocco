/* eslint-disable @typescript-eslint/no-explicit-any */


import {
    BooksInterface,
    CouchDocument,
    DesignDocument,
    MapReduceRow,
    Replicator,
    PluginInterfaceLookup,
    LibroccoPlugin,
} from "@/types";
import { OrdersDatabaseInterface } from "./types";

import designDocs from "./designDocuments";
import { newBooksInterface } from "./books";
import { newDbReplicator } from "./replicator";
import { newView } from "./view";
import { newPluginsInterface, PluginsInterface } from "./plugins";

import { scanDesignDocuments } from "@/utils/pouchdb";

class Database implements OrdersDatabaseInterface {
    _pouch: PouchDB.Database;

    #booksInterface?: BooksInterface;

    #plugins: PluginsInterface;


    constructor(db: PouchDB.Database) {
        this._pouch = db;

        this.#plugins = newPluginsInterface();


        return this;
    }

    books(): BooksInterface {
        // We're caching the books interface to avoid creating multiple instances
        return this.#booksInterface ?? (this.#booksInterface = newBooksInterface(this));
    }

    // #region setup
    replicate(): Replicator {
        return newDbReplicator(this);
    }



    async buildIndices() {
        const indexes = scanDesignDocuments(designDocs);
        await Promise.all(indexes.map((view) => this._pouch.query(view)));
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
    view<R extends MapReduceRow, M extends CouchDocument = CouchDocument>(view: string) {
        return newView<R, M>(this._pouch, view);
    }
}

export const newDatabase = (db: PouchDB.Database): OrdersDatabaseInterface => {
    return new Database(db);
};
