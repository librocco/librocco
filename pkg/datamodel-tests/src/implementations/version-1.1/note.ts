import { VolumeTransactionTuple, VolumeStock } from '@/types';
import { sortBooks } from '@/utils/misc';
import { NoteInterface, WarehouseInterface, NoteData } from './types';

class Note implements NoteInterface {
	// We wish the warehouse back-reference to be "invisible" when printing, serializing JSON, etc.
	// Prepending the property with "#" achieves the desired result by making the property non-enumerable.
	#w;

	_id;
	_rev?;
	type;
	books;
	committed;

	constructor(warehouse: WarehouseInterface, data: NoteData) {
		this.#w = warehouse;

		this._id = data._id;
		this.type = data.type;
		this.committed = Boolean(data.committed);
		this.books = data.books || [];
		if (data._rev) {
			this._rev = data._rev || '';
		}
	}

	addVolumes(...params: Parameters<NoteInterface['addVolumes']>): Promise<NoteInterface> {
		// A check to see if the update function should be ran once or multiple times
		const isTuple = (
			params: Parameters<NoteInterface['addVolumes']>
		): params is VolumeTransactionTuple => {
			return !Array.isArray(params[0]);
		};

		const updateQuantity = (isbn: string, quantity: number, warehouse = this.#w.name) => {
			const matchIndex = this.books.findIndex(
				(entry) => entry.isbn === isbn && entry.warehouse === warehouse
			);

			if (matchIndex === -1) {
				this.books.push({ isbn, warehouse, quantity });
				return;
			}

			this.books[matchIndex] = { isbn, warehouse, quantity: this[matchIndex].quantity + quantity };
		};

		if (isTuple(params)) {
			updateQuantity(params[0], params[1], params[2]);
		} else {
			params.forEach((update) => updateQuantity(update[0], update[1], update[2]));
		}

		return this.#w.updateNote(this);
	}

	getVolume(isbn: string): VolumeStock[] {
		return this.books
			.reduce((acc, b) => (b.isbn === isbn ? [...acc, b] : acc), [] as VolumeStock[])
			.sort(sortBooks);
	}

	getVolumes(): VolumeStock[] {
		return this.books.sort(sortBooks);
	}

	updateTransaction(
		i: number,
		{ quantity, warehouse }: Pick<VolumeStock, 'quantity' | 'warehouse'>
	): Promise<NoteInterface> {
		this.books[i].quantity = quantity;
		this.books[i].warehouse = warehouse;
		return this.#w.updateNote(this);
	}

	delete(): Promise<void> {
		return this.#w.deleteNote(this);
	}

	commit(): Promise<NoteInterface> {
		this.committed = true;
		return this.#w.updateNote(this);
	}

	updateRev(rev: string): NoteInterface {
		this._rev = rev;
		return this;
	}
}

export const newNote = (w: WarehouseInterface, data: NoteData): NoteInterface => {
	return new Note(w, data);
};
