/* eslint-disable @typescript-eslint/no-explicit-any */
import { debug } from '@librocco/shared';

import { DocType } from '@/enums';

import { BookEntry, CouchDocument, DbStream, DesignDocument, InNoteList, NavListEntry } from '@/types';

import { DatabaseInterface, WarehouseInterface } from './types';
import designDocs from './designDocuments';
import { newWarehouse } from './warehouse';

import { newViewStream, replicateFromRemote, replicateLive } from '@/utils/pouchdb';

class Database implements DatabaseInterface {
	_pouch: PouchDB.Database;
	#initialised = false;

	constructor(db: PouchDB.Database) {
		this._pouch = db;
	}

	async init(params: { remoteDb?: string }, ctx: debug.DebugCtx): Promise<DatabaseInterface> {
		if (this.#initialised) return this;

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
				// Pull data from the remote db (if provided)
				await replicateFromRemote({ local: this._pouch, remote: params.remoteDb }, ctx);
				// Start live sync between local and remote db
				replicateLive({ local: this._pouch, remote: params.remoteDb }, ctx);
			}
			return;
		})();
		promises.push(replication);

		// Wait for all the init operations to complete before returning
		await Promise.all(promises);
		this.#initialised = true;

		return this;
	}

	async getBook(isbn: string): Promise<CouchDocument<BookEntry> | undefined> {
		return await this._pouch.get(isbn);
	}

	async getBooks(isbns: string[]): Promise<CouchDocument<BookEntry>[]> {
		const rawBooks = await this._pouch.allDocs({ keys: isbns, include_docs: true });
		// The rows are returned in the same order as the supplied keys array.
		// The row for a nonexistent document will just contain an "error" property with the value "not_found".

		/** @TODO type assertion function for query instead of casting? */
		const bookDocs = rawBooks.rows.reduce((values: CouchDocument<BookEntry>[], value) => {
			if (value.doc) values.push(value.doc as CouchDocument<BookEntry>);
			return values;
		}, []);

		return bookDocs;
	}

	async upsertBook(bookEntry: BookEntry): Promise<void> {
		/** @TODO handle doc not found better? */
		try {
			const bookDocument = await this._pouch.get(bookEntry.isbn);
			console.log('bookDocument', { bookDocument });
			await this._pouch.put({ ...bookDocument, ...bookEntry });
			return;
		} catch (err) {
			console.log('document not found');
		}
		await this._pouch.put({ ...bookEntry, _id: bookEntry.isbn });

		return;
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
