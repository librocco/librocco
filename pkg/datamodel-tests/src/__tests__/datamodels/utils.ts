import { RawSnap } from '@/types';
import { BookStock, NoteType, Stock, Note } from './types';

import { defaultTransformBook } from '@runner/test-setup';

import { sortById } from '@/utils/pouchdb';

export const pickBooksWithQuantity = (sn: RawSnap): { books: BookStock[] } => ({
	books: sn.books
		.map((b) => ({ ...defaultTransformBook(b), quantity: b.quantity, warehouse: b.warehouse }))
		.sort(sortById)
});

const incrementA = (a = 0, b: number) => a + b;
const decrementA = (a = 0, b: number) => a - b;

const updateQuantity = (
	old: BookStock | undefined,
	patch: BookStock,
	noteType: NoteType
): BookStock => {
	const quantityFunction = {
		'in-note': incrementA,
		'out-note': decrementA
	}[noteType];

	return {
		...patch,
		quantity: quantityFunction(old?.quantity, patch.quantity)
	};
};

export const updateStock = (fullStock: Stock, note: Note): Stock => {
	const newStock: Stock = { ...fullStock, books: [...fullStock.books] };

	note.books.forEach((b) => {
		// If in warehouse mode, skip books not belonging to the warehouse
		if (fullStock._id != 'all-warehouses' && fullStock._id !== b.warehouse) {
			return;
		}

		let i = newStock.books.findIndex(({ _id }) => _id === b._id);
		if (i === -1) {
			i = newStock.books.length;
		}
		newStock.books[i] = updateQuantity(newStock.books[i], b, note.type);
	});

	return newStock;
};
