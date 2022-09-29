import { VolumeQuantityTuple } from './types';
import { NoteInterface, WarehouseInterface, NoteData } from './types-implementation';

export class Note implements NoteInterface {
	private _w;

	_id;
	_rev;
	type;
	books;
	committed;

	constructor(warehouse: WarehouseInterface, data: NoteData) {
		this._w = warehouse;

		this._id = data._id;
		this.type = data.type;
		this.books = data.books || [];
		this.committed = Boolean(data.committed);
		this._rev = data._rev || '';
	}

	addVolumes(...params: Parameters<NoteInterface['addVolumes']>): Promise<NoteInterface> {
		// A check to see if the update function should be ran once or multiple times
		const isTuple = (
			params: Parameters<NoteInterface['addVolumes']>
		): params is VolumeQuantityTuple => {
			return Array.isArray(params[0]);
		};

		const updateQuantity = (isbn: string, quantity: number) => {
			if (this.books[isbn]) {
				this.books[isbn] += quantity;
			} else {
				this.books[isbn] = quantity;
			}
		};

		if (isTuple(params)) {
			updateQuantity(...params);
		} else {
			params.forEach((update) => updateQuantity(...update));
		}

		return this._w.updateNote(this);
	}

	setVolumeQuantity(isbn: string, quantity: number): Promise<NoteInterface> {
		this.books[isbn] = quantity;
		return this._w.updateNote(this);
	}

	delete(): Promise<void> {
		return this._w.deleteNote(this);
	}

	commit(): Promise<NoteInterface> {
		this.committed = true;
		return this._w.updateNote(this);
	}
}

export const newNote = (w: WarehouseInterface, data: NoteData): NoteInterface => {
	return new Note(w, data);
};
