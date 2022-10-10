/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { CouchDocument, DatabaseInterface, VolumeStock, VolumeTransactionTuple } from '@/types';
import { NoteInterface, WarehouseInterface, NoteData, TransactionDocument } from './types';

import { unwrapDocs } from '@/utils/pouchdb';
import { uniqueTimestamp } from './utils';

export class Note implements NoteInterface {
	// We wish the warehouse back-reference to be "invisible" when printing, serializing JSON, etc.
	// Prepending the property with "#" achieves the desired result by making the property non-enumerable.
	#w;
	#db;

	_id;
	_rev?;
	transactions = [] as [string, string][];
	type;
	committed;

	constructor(warehouse: WarehouseInterface, database: DatabaseInterface, data: NoteData) {
		this.#w = warehouse;
		this.#db = database;

		this._id = data._id;
		this.type = data.type;
		this.committed = Boolean(data.committed);
		if (data.books) {
			this.transactions = data._rev;
		}
		if (data._rev) {
			this._rev = data._rev;
		}
	}

	async addVolumes(...params: Parameters<NoteInterface['addVolumes']>): Promise<NoteInterface> {
		// A check to see if the update function should be ran once or multiple times
		const isTuple = (
			params: Parameters<NoteInterface['addVolumes']>
		): params is VolumeTransactionTuple => {
			return !Array.isArray(params[0]);
		};

		const updateQuantity = (isbn: string, quantity: number, warehouse = this.#w.name, i = 0) => {
			// Create an id for the volume transaction by prepending the note id and adding the
			// timestamp at the end of the document (as we might have multiple entries with the same isbn).
			const _id = [this._id, isbn, uniqueTimestamp(i)].join('/');

			const data = { isbn, warehouse, quantity };

			// Add the transaction to the transaction list immediately, to "reserve" the spot.
			// We're updating this with the new '_rev' down below.
			const transactionIndex = this.transactions.length;
			this.transactions.push([_id, '']);

			// We wish the first part of the function to be ran synchronously,
			// but return the promise so that the function can be awaited, so we're
			// using this syntactic hack (it's equivalend to returning a `new Promise`)
			return (async () => {
				const { rev } = await this.#db._pouch.put({ _id, ...data });
				this.transactions[transactionIndex] = [_id, rev];
			})();
		};

		if (isTuple(params)) {
			await updateQuantity(params[0], params[1], params[2]);
		} else {
			const updates = params.map((update, i) => updateQuantity(update[0], update[1], update[2], i));
			await Promise.all(updates);
		}

		return this.#w.updateNote(this);
	}

	async getVolume(isbn: string): Promise<VolumeStock[]> {
		const transactionDocs = await this.#db._pouch.allDocs({
			startkey: `${this._id}/${isbn}/`,
			endkey: `${this._id}/${isbn}0`,
			include_docs: true
		});
		return (unwrapDocs(transactionDocs) as CouchDocument<VolumeStock>[]).map(
			// eslint-disable-next-line @typescript-eslint/no-unused-vars
			({ _id, _rev, ...transaction }) => transaction
		);
	}

	async getVolumes(): Promise<CouchDocument<VolumeStock>[]> {
		const transactionDocs = await this.#db._pouch.allDocs({
			startkey: `${this._id}/`,
			endkey: `${this._id}0`,
			include_docs: true
		});
		return unwrapDocs(transactionDocs) as CouchDocument<VolumeStock>[];
	}

	async updateTransaction(
		i: number,
		transactionUpdate: Pick<VolumeStock, 'quantity' | 'warehouse'>
	): Promise<NoteInterface> {
		const tr = this.transactions[i];
		if (!tr) {
			throw new Error('Trying to update a non existing transaction');
		}
		const [_id, _rev] = tr;

		const { rev: newRev } = await this.#db._pouch.put({ _id, _rev, ...transactionUpdate });
		this.transactions[i] = [_id, newRev];

		return this.#w.updateNote(this);
	}

	delete(): Promise<void> {
		return this.#w.deleteNote(this);
	}

	// TODO: A bit messy
	async commit(): Promise<NoteInterface> {
		const rawTransactions = await this.getVolumes();

		type DeleteSentinel = { _id: string; _rev: string; _deleted: true };

		const { updates, deletes } = rawTransactions.reduce(
			({ updates, deletes }, t) => {
				const matchIndex = updates.findIndex(
					({ isbn, warehouse }) => isbn === t.isbn && warehouse === t.warehouse
				);

				// If no entry with this isbn and warehouse found, add it for update
				if (matchIndex === -1) {
					updates = [...updates, { ...t, committed: true }];
					return { updates, deletes };
				}

				// If the isbn/warehouse transaction already exists, aggregate it and queue the current document for deletion
				updates[matchIndex].quantity += t.quantity;
				deletes = [...deletes, { _id: t._id, _rev: t._rev!, _deleted: true }];
				return { updates, deletes };
			},
			{ updates: [] as TransactionDocument[], deletes: [] as DeleteSentinel[] }
		);

		// Update note document itself
		const deleteIds = deletes.map(({ _id }) => _id);
		this.transactions = this.transactions.filter(([_id]) => !deleteIds.includes[_id]);
		this.committed = true;

		await this.#db._pouch.bulkDocs([...deletes, ...updates]);

		return this.#w.updateNote(this);
	}

	updateRev(rev: string): NoteInterface {
		this._rev = rev;
		return this;
	}
}

export const newNote = (
	w: WarehouseInterface,
	db: DatabaseInterface,
	data: NoteData
): NoteInterface => {
	return new Note(w, db, data);
};
