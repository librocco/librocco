/* eslint-disable @typescript-eslint/no-explicit-any */
import { unwrapDoc, unwrapDocs } from '../../utils/pouchdb';
import {
	CouchDocument,
	MapWarehouses,
	RawBookStock,
	RawSnap,
	TransformNote,
	TransformSnap,
	TestSetup
} from '../../types';
import { defaultTransformBook } from '../test-setup';

import {
	createCommitNote,
	createDBInteractions,
	createGetNotes,
	createGetStock,
	createGetWarehouses
} from '../../utils/test-setup';

// #region types
type NoteType = 'in-note' | 'out-note';

type BookStock = CouchDocument<Pick<RawBookStock, 'quantity' | 'warehouse'>>;
type Stock = CouchDocument<{ books: BookStock[] }>;
type Note = Stock & { type: NoteType };
// #endregion types

// #region transform_data
const sortById = ({ _id: id1 }: CouchDocument, { _id: id2 }: CouchDocument) => (id1 < id2 ? -1 : 1);

const pickBooksWithQuantity = (sn: RawSnap): { books: BookStock[] } => ({
	books: sn.books
		.map((b) => ({ ...defaultTransformBook(b), quantity: b.quantity, warehouse: b.warehouse }))
		.sort(sortById)
});

const transformSnaps: TransformSnap<Stock> = (sn) => ({
	_id: 'all-warehouses',
	...pickBooksWithQuantity(sn)
});

const transformWarehouse: TransformSnap<Stock> = (sn) => ({
	_id: sn.id,
	...pickBooksWithQuantity(sn)
});

const transformNotes: TransformNote<Note> = (n) => ({
	_id: n.id,
	type: n.type,
	...pickBooksWithQuantity(n)
});

const mapWarehouses: MapWarehouses = (b, addToWarehouse) => addToWarehouse(b.warehouse);
// end#region transform_data

// #region DBInteractions
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

const updateStock = (fullStock: Stock, note: Note): Stock => {
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

const commitNote = createCommitNote<Note>((db) => async (note) => {
	// Get warehouses to update
	const wNames = [...note.books.reduce((acc, curr) => acc.add(curr.warehouse), new Set<string>())];

	// Get stock documents to update (all-warehouses + every warehouse found in the note)
	const stockDocuments = await Promise.all(
		['all-warehouses', ...wNames].map(
			(docId) =>
				new Promise<Stock>((resolve) => {
					db.get(docId)
						.then((doc) => resolve(doc as any))
						.catch(() => resolve({ _id: docId, books: [] }));
				})
		)
	);

	// Update book stock on all-warehouses as well as each respective warehouse
	const updatedStock = stockDocuments.map((stock) => updateStock(stock, note));
	const updates = updatedStock.map((doc) => db.put(doc));

	// Add note put to updates to write them all in one Promise.all
	updates.push(db.put(note));

	await Promise.all(updates);
});

const getNotes = createGetNotes((db) => async () => {
	const res = await db.allDocs({
		startkey: 'note-000',
		endkey: 'note-009',
		inclusive_end: true,
		include_docs: true
	});
	return unwrapDocs(res);
});

const getStock = createGetStock((db) => async () => {
	const res = await db.get('all-warehouses');
	const unwrappedDoc = unwrapDoc(res) as Stock;
	unwrappedDoc.books = unwrappedDoc.books.sort(sortById);
	return unwrappedDoc;
});

const getWarehouses = createGetWarehouses((db) => async () => {
	const res = await db.allDocs({
		keys: ['science', 'jazz'],
		include_docs: true
	});
	const warehouses = (unwrapDocs(res) as Stock[]).map((warehouse) => ({
		...warehouse,
		books: warehouse.books.sort(sortById)
	}));
	return warehouses;
});
// #region DBInteractions

export default {
	transform: {
		transformSnaps,
		transformNotes,
		mapWarehouses,
		transformWarehouse
	},

	createDBInterface: createDBInteractions({
		commitNote,
		getNotes,
		getStock,
		getWarehouses
	})
} as TestSetup;
