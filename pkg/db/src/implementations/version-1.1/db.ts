/* eslint-disable @typescript-eslint/no-explicit-any */
import { debug } from '@librocco/shared';

import { DocType } from '@/enums';

import { BooksInterface, DbStream, DesignDocument, InNoteList, NavListEntry } from '@/types';
import { DatabaseInterface, WarehouseInterface } from './types';

import { NEW_WAREHOUSE } from '@/constants';

import designDocs from './designDocuments';
import { newWarehouse } from './warehouse';

import { newViewStream, replicateFromRemote, replicateLive } from '@/utils/pouchdb';
import { newBooksInterface } from './books';
import { replicationError } from './misc';

class Database implements DatabaseInterface {
	_pouch: PouchDB.Database;
	#initialised = false;

	constructor(db: PouchDB.Database) {
		this._pouch = db;

		// Currently we're using up to 14 listeners (21 when replication is enabled).
		// This increases the limit to a reasonable threshold, leaving some room for slower performance,
		// but will still show a warning if that number gets unexpectedly high (memory leak).
		this._pouch.setMaxListeners(30);
	}

	async init(params: { remoteDb?: string }, ctx: debug.DebugCtx): Promise<DatabaseInterface> {
		debug.log(ctx, 'init_db:started')({});
		if (this.#initialised) {
			debug.log(ctx, 'init_db:already_initialised')({});
			return this;
		}

		const promises: Promise<any>[] = [];

		// Upload design documents if any
		if (designDocs.length) {
			designDocs.forEach((dd) => {
				promises.push(this.updateDesignDoc(dd));
			});
		}

		// create default warehouse
		const whPromise = this.warehouse().create();
		promises.push(whPromise);

		const replication = (async () => {
			if (params && params.remoteDb) {
				debug.log(ctx, 'init_db:replication:started')({ remoteDb: params.remoteDb });

				// We're wrapping the replication in a try/catch block to prevent the app from crashing
				// if the remote db is not available.
				try {
					// Pull data from the remote db (if provided)
					await replicateFromRemote({ local: this._pouch, remote: params.remoteDb }, ctx);
					debug.log(ctx, 'init_db:replication:initial_replication_done')({});
					// Start live sync between local and remote db
					replicateLive({ local: this._pouch, remote: params.remoteDb }, ctx);
				} catch (err) {
					// If remote db is not available, log the error and continue.
					console.error(err);
					console.error(replicationError);
				}
			} else {
				debug.log(ctx, 'init_db:replication:skipped')({});
			}
			return;
		})();
		promises.push(replication);

		// Wait for all the init operations to complete before returning
		await Promise.all(promises);
		this.#initialised = true;

		return this;
	}

	books(): BooksInterface {
		return newBooksInterface(this);
	}

	warehouse(id?: string | typeof NEW_WAREHOUSE): WarehouseInterface {
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
				'v1_list/warehouses',
				{},
				({ rows }) => rows.map(({ key: id, value: { displayName = '' } }) => ({ id, displayName })),
				ctx
			),

			outNoteList: newViewStream<{ rows: { key: string; value: { displayName?: string; committed?: boolean } } }, NavListEntry[]>(
				this._pouch,
				'v1_list/outbound',
				{},
				({ rows }) =>
					rows
						.filter(({ value: { committed } }) => !committed)
						.map(({ key: id, value: { displayName = '' } }) => ({ id, displayName })),
				ctx
			),

			inNoteList: newViewStream<
				{ rows: { key: string; value: { type: DocType; displayName?: string; committed?: boolean } } },
				InNoteList
			>(
				this._pouch,
				'v1_list/inbound',
				{},
				({ rows }) =>
					rows.reduce((acc, { key, value: { type, displayName = '', committed } }) => {
						if (type === 'warehouse') {
							return [...acc, { id: key, displayName, notes: [] }];
						}
						if (committed) {
							return acc;
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
