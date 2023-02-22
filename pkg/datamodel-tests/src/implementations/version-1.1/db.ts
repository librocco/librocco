import { DbStream, DesignDocument, DocType, InNoteList, NavListEntry, utils } from '@librocco/db';
import { debug } from '@librocco/shared';

import { DatabaseInterface, WarehouseInterface } from './types';
import designDocs from './designDocuments';
import { newWarehouse } from './warehouse';

const { newViewStream } = utils;

class Database implements DatabaseInterface {
	_pouch: PouchDB.Database;

	constructor(db: PouchDB.Database) {
		this._pouch = db;

		// Initialize the default warehouse (this makes sure the "0-all" warehouse exists, otherwise it will be created)
		// All of this is done automatically when running db.warehouse('0-all')
		this.warehouse('0-all').create();
	}
	async init(remote?: { database: PouchDB.Database }) {
		//  Utilise db.updateDesignDoc to load the design documents into the db

		let promises = [];

		// Upload design documents if any
		const ddUpdates = designDocs.map((dd) => this.updateDesignDoc(dd));
		if (ddUpdates?.length) {
			promises.push(ddUpdates);
		}

		// create default warehouse
		const whPromise = this.warehouse().create();
		promises.push(whPromise);

		// Set up replication between local pouch and "remote" couch
		remote && promises.push(replicate({ local: this._pouch, remote: remote.database }));
		return Promise.all(promises);
	}

	warehouse(id?: string): WarehouseInterface {
		return newWarehouse(this, id);
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

	async findNote(id: string) {
		// Note id looks something like this: "v1/<warehouse-id>/<note-type>/<note-id>"
		const idSegments = id.split('/');

		// Validate the id is correct
		if (idSegments.length !== 4) {
			throw new Error(`Invalid note id: ${id}`);
		}

		// Get version number and warehouse id from the path segments
		const [v, w] = idSegments;
		const warehouseId = `${v}/${w}`;
		const [note, warehouse] = await Promise.all([this.warehouse(warehouseId).note(id).get(), this.warehouse(warehouseId).get()]);

		return note && warehouse ? { note, warehouse } : undefined;
	}

	stream(ctx: debug.DebugCtx): DbStream {
		return {
			warehouseList: newViewStream<{ rows: { key: string; value: { displayName?: string } } }, NavListEntry[]>(
				this._pouch,
				'list/warehouses',
				{},
				({ rows }) => rows.map(({ key: id, value: { displayName = '' } }) => ({ id, displayName })),
				ctx
			),

			outNoteList: newViewStream<{ rows: { key: string; value: { displayName?: string } } }, NavListEntry[]>(
				this._pouch,
				'list/outbound',
				{},
				({ rows }) => rows.map(({ key: id, value: { displayName = '' } }) => ({ id, displayName })),
				ctx
			),

			inNoteList: newViewStream<{ rows: { key: string; value: { type: DocType; displayName?: string } } }, InNoteList>(
				this._pouch,
				'list/inbound',
				{},
				({ rows }) =>
					rows.reduce((acc, { key, value: { type, displayName = '' } }) => {
						if (type === 'warehouse') {
							return [...acc, { id: key, displayName, notes: [] }];
						}
						// Add note to the default warehouse (first in the list) as well as the corresponding warehouse (last in the list so far)
						acc[0].notes.push({ id: key, displayName });
						acc[acc.length - 1].notes.push({ id: key, displayName });
						return acc;
					}, [] as InNoteList),
				ctx
			)
		};
	}
}

export const newDatabase = (db: PouchDB.Database): Database => {
	return new Database(db);
};

/**
 * A function that handles replication, returns resolve when replication is complete and reject otherwise
 * @param local - local pouchdb instance
 * @param remote - remote pouchdb instance
 */

const replicate = (database: { remote: PouchDB.Database; local: PouchDB.Database }) =>
	new Promise<void>((resolve, reject) => {
		database.local.replicate
			.to(database.remote)
			.on('complete', function () {
				// yay, we're done!
				console.log('Replication complete');
				resolve();
			})
			.on('error', function (err) {
				// boo, something went wrong!
				console.log('could not replicate to remote db', err);
				reject();
			});
	});

// #region Database
