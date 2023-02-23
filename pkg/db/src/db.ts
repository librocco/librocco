/* eslint-disable @typescript-eslint/no-explicit-any */
import { DocType } from './enums';

import { debug } from '@librocco/shared';

import { DbStream, DesignDocument, InNoteList, NavListEntry } from './types';
import { DatabaseInterface, WarehouseInterface } from './types/version_1';

import { newWarehouse } from './warehouse';

import { newViewStream } from './utils';

import designDocs from './design_documents';

import { replicateFromRemote, replicateLive } from './utils/pouchdb';

class Database implements DatabaseInterface {
	_pouch: PouchDB.Database;
	private initialised = false;

	constructor(db: PouchDB.Database) {
		this._pouch = db;
	}

	async init(params: { remoteDb?: string }, ctx: debug.DebugCtx): Promise<DatabaseInterface> {
		if (this.initialised) return this;

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

		if (params && params.remoteDb) {
			// Pull data from the remote db (if provided)
			const initialReplication = replicateFromRemote({ local: this._pouch, remote: params.remoteDb }, ctx);
			promises.push(initialReplication);

			// Start live sync between local and remote db
			replicateLive({ local: this._pouch, remote: params.remoteDb }, ctx);
		}

		// Wait for all the init operations to complete before returning
		await Promise.all(promises);
		this.initialised = true;

		return this;
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
		const [note, warehouse] = await Promise.all([
			this.warehouse(warehouseId).note(id).get(),
			this.warehouse(warehouseId).get()
		]);

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

			inNoteList: newViewStream<
				{ rows: { key: string; value: { type: DocType; displayName?: string } } },
				InNoteList
			>(
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
