import { newViewStream } from '@/utils/pouchdb';
import { DbStream, DesignDocument, DocType, InNoteList, NavListEntry } from '@librocco/db';

import { DatabaseInterface, WarehouseInterface } from './types';

import { newWarehouse } from './warehouse';

class Database implements DatabaseInterface {
	_pouch: PouchDB.Database;

	constructor(db: PouchDB.Database) {
		this._pouch = db;

		// Initialize the default warehouse (this makes sure the "0-all" warehouse exists, otherwise it will be created)
		// All of this is done automatically when running db.warehouse('0-all')
		this.warehouse('0-all').create();
	}

	warehouse(id?: string): WarehouseInterface {
		return newWarehouse(this, id);
	}

	updateDesignDoc(doc: DesignDocument) {
		return this._pouch.put(doc);
	}

	async findNote(id: string) {
		// Note id looks something like this: "v1/<warehouse-id>/<note-type>/<note-id>"
		const idSegments = id.split('/');

		// Validate the id is correct
		if (idSegments.length !== 4) {
			throw new Error(`Invalid note id: ${id}`);
		}

		const [warehouse] = idSegments;
		return this.warehouse(warehouse).note(id).get();
	}

	stream(): DbStream {
		return {
			warehouseList: newViewStream<{ rows: { key: string; value: { displayName?: string } } }, NavListEntry[]>(
				this._pouch,
				'list/warehouses',
				{},
				({ rows }) => rows.map(({ key: id, value: { displayName = '' } }) => ({ id, displayName }))
			),

			outNoteList: newViewStream<{ rows: { key: string; value: { displayName?: string } } }, NavListEntry[]>(
				this._pouch,
				'list/outbound',
				{},
				({ rows }) => rows.map(({ key: id, value: { displayName = '' } }) => ({ id, displayName }))
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
					}, [] as InNoteList)
			)
		};
	}
}

export const newDatabase = (db: PouchDB.Database): Database => {
	return new Database(db);
};

// #region Database
