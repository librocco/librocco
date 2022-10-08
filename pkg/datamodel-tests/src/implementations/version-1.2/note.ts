import { VolumeStock, VolumeTransactionTuple } from '@/types';
import { sortBooks } from '@/utils/misc';
import { NoteInterface, WarehouseInterface, NoteData } from './types';

export class Note implements NoteInterface {
	// We wish the warehouse back-reference to be "invisible" when printing, serializing JSON, etc.
	// Prepending the property with "#" achieves the desired result by making the property non-enumerable.
	#w;

	_id;
	_rev;
	type;
	books;
	committed;

	constructor(warehouse: WarehouseInterface, data: NoteData) {
		this.#w = warehouse;

		this._id = data._id;
		this.type = data.type;
		this.books = data.books || {};
		this.committed = Boolean(data.committed);
		this._rev = data._rev || '';
	}

	addVolumes(...params: Parameters<NoteInterface['addVolumes']>): Promise<NoteInterface> {
		// A check to see if the update function should be ran once or multiple times
		const isTuple = (
			params: Parameters<NoteInterface['addVolumes']>
		): params is VolumeTransactionTuple => {
			return !Array.isArray(params[0]);
		};

		const updateQuantity = (isbn: string, quantity: number, warehouseName = this.#w.name) => {
			if (!this.books[isbn]) {
				this.books[isbn] = { [warehouseName]: quantity };
				return;
			}
			if (!this.books[isbn][warehouseName]) {
				this.books[isbn][warehouseName] = quantity;
				return;
			}
			this.books[isbn][warehouseName] += quantity;
		};

		if (isTuple(params)) {
			updateQuantity(params[0], params[1], params[2]);
		} else {
			params.forEach((update) => updateQuantity(update[0], update[1], update[2]));
		}

		return this.#w.updateNote(this);
	}

	getVolume(isbn: string): VolumeStock[] {
		return Object.entries(this.books[isbn])
			.map(([warehouse, quantity]) => ({
				isbn,
				warehouse,
				quantity
			}))
			.sort(sortBooks);
	}

	getVolumes(): VolumeStock[] {
		return Object.entries(this.books)
			.reduce(
				(acc, [isbn, warehouseQuantity]) => [
					...acc,
					...Object.entries(warehouseQuantity).map(([warehouse, quantity]) => ({
						isbn,
						warehouse,
						quantity
					}))
				],
				[] as VolumeStock[]
			)
			.sort(sortBooks);
	}

	setVolumeQuantity(isbn: string, quantity: number): Promise<NoteInterface> {
		this.books[isbn].quantity = quantity;
		return this.#w.updateNote(this);
	}

	delete(): Promise<void> {
		return this.#w.deleteNote(this);
	}

	commit(): Promise<NoteInterface> {
		this.committed = true;
		return this.#w.updateNote(this);
	}
}

export const newNote = (w: WarehouseInterface, data: NoteData): NoteInterface => {
	return new Note(w, data);
};
