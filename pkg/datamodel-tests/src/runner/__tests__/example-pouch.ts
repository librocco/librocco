/* eslint-disable @typescript-eslint/no-explicit-any */
import { unwrapDoc, unwrapDocs } from 'src/utils/pouchdb';
import {
	CouchDocument,
	MapWarehouses,
	RawBookStock,
	RawSnap,
	TransformConfig,
	TransformNote,
	TransformSnap
} from '../../types';
import { defaultTransformBook } from '../testSetup';

// #region types
type NoteType = 'in-note' | 'out-note';

type BookStock = CouchDocument<Pick<RawBookStock, 'quantity' | 'warehouse'>>;
type Stock = CouchDocument<{ books: BookStock[] }>;
type Note = Stock & { type: NoteType };
// #endregion types

// #region transform_data
const pickBooksWithQuantity = (sn: RawSnap): { books: BookStock[] } => ({
	books: sn.books
		.map((b) => ({ ...defaultTransformBook(b), quantity: b.quantity, warehouse: b.warehouse }))
		.sort(({ _id: id1 }, { _id: id2 }) => (id1 < id2 ? -1 : 1))
});

const transformSnaps: TransformSnap = (sn) => ({
	_id: 'all-warehouses',
	...pickBooksWithQuantity(sn)
});

const transformWarehouse: TransformSnap = (sn) => ({
	_id: sn.id,
	...pickBooksWithQuantity(sn)
});

const transformNotes: TransformNote = (n) => ({
	_id: n.id,
	type: n.type,
	...pickBooksWithQuantity(n)
});

const mapWarehouses: MapWarehouses = (b, addToWarehouse) => addToWarehouse(b.warehouse, b);
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

const commitNote: DBInteractionHOF<void, [Note]> = (db) => async (note) => {
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
};

const getNotes: DBInteractionHOF<CouchDocument[]> = (db) => async () => {
	const res = await db.allDocs({
		startkey: 'note-000',
		endkey: 'note-009',
		inclusive_end: true,
		include_docs: true
	});
	return unwrapDocs(res);
};

const getStock: DBInteractionHOF<CouchDocument> = (db) => async () => {
	const res = await db.get('all-warehouses');
	return unwrapDoc(res);
};

const getWarehouses: DBInteractionHOF<CouchDocument[]> = (db) => async () => {
	const res = await db.allDocs({
		keys: ['science', 'jazz'],
		include_docs: true
	});
	return unwrapDocs(res);
};

interface DBInteraction<R = void, P extends any[] = never[]> {
	(...params: P): Promise<R>;
}
interface DBInteractionHOF<R = void, P extends any[] = never[]> {
	(db: PouchDB.Database): DBInteraction<R, P>;
}

interface CreateDBInterface {
	(db: PouchDB.Database): {
		commitNote: DBInteraction<void, [CouchDocument]>;
		getNotes: DBInteraction<CouchDocument[]>;
		getStock: DBInteraction<CouchDocument>;
		getWarehouses: DBInteraction<CouchDocument[]>;
	};
}

interface TestCase extends TransformConfig {
	createDBInterface: CreateDBInterface;
}

export default {
	transformSnaps,
	transformNotes,
	mapWarehouses,
	transformWarehouse,

	createDBInterface: (db) => ({
		commitNote: commitNote(db),
		getNotes: getNotes(db),
		getStock: getStock(db),
		getWarehouses: getWarehouses(db)
	})
} as TestCase;
