/* eslint-disable @typescript-eslint/no-explicit-any */
import {
	CouchDocument,
	MapWarehouses,
	RawBookStock,
	RawSnap,
	TransformNote,
	TransformSnap
} from '../../types';
import { defaultTransformBook } from '../testSetup';

// #region transform_data
const pickBooksWithQuantity = (sn: RawSnap): { books: BS[] } => ({
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

type BS = CouchDocument<Pick<RawBookStock, 'quantity' | 'warehouse'>>;
type ST = CouchDocument<{ books: BS[] }>;
type N = ST & { type: string };

const addBooks = (old: BS | undefined, patch: BS): BS => ({
	...patch,
	quantity: old ? old.quantity + patch.quantity : patch.quantity
});
const removeBooks = (old: BS, patch: BS): BS => ({
	...patch,
	quantity: old.quantity - patch.quantity
});

const updateQuantity = {
	'in-note': addBooks,
	'out-note': removeBooks
};

const updateStock = (fullStock: ST, note: N): ST => {
	const newStock: ST = { ...fullStock, books: [...fullStock.books] };

	note.books.forEach((b) => {
		// If in warehouse mode, skip books not belonging to the warehouse
		if (fullStock._id != 'all-warehouses' && fullStock._id !== b.warehouse) {
			return;
		}

		let i = newStock.books.findIndex(({ _id }) => _id === b._id);
		if (i === -1) {
			i = newStock.books.length;
		}
		newStock.books[i] = updateQuantity[note.type](newStock.books[i], b);
	});

	return newStock;
};

const commitNote = (db: PouchDB.Database) => async (note: N) => {
	// Store note in the db
	db.put(note);

	// Get warehouses to update
	const wNames = [...note.books.reduce((acc, curr) => acc.add(curr.warehouse), new Set<string>())];

	// Update the full book stock
	const [fullStock, ...warehouses] = await Promise.all(
		['all-warehouses', ...wNames].map(
			(docId) =>
				new Promise<
					CouchDocument<{
						books: BS[];
					}>
				>((resolve) => {
					db.get(docId)
						.then((doc) => resolve(doc as any))
						.catch(() => resolve({ _id: docId, books: [] }));
				})
		)
	);
	const newStock = updateStock(fullStock, note);
	const updatedWarehouses = warehouses.map((w) => updateStock(w, note));
	await Promise.all([newStock, ...updatedWarehouses].map((doc) => db.put(doc)));
};

const getNotes = (db: PouchDB.Database) => async () => {
	const res = await db.allDocs({
		startkey: 'note-000',
		endkey: 'note-009',
		inclusive_end: true,
		include_docs: true
	});
	return res.rows.map(({ doc }) => {
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const { _rev, ...document } = doc || {};
		return document;
	});
};

const getStock = (db: PouchDB.Database) => async () => {
	const res = await db.get('all-warehouses');
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	const { _rev, ...document } = res;
	return document;
};

const getWarehouses = (db: PouchDB.Database) => async () => {
	const res = await db.allDocs({
		keys: ['science', 'jazz'],
		include_docs: true
	});
	return res.rows.reduce((acc, { doc }) => {
		if (!doc) {
			return acc;
		}
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const { _rev, ...document } = doc;
		return [...acc, document];
	}, [] as CouchDocument[]);
};

export default {
	transformSnaps,
	transformNotes,
	mapWarehouses,
	transformWarehouse,

	setupDB: (db: PouchDB.Database) => ({
		commitNote: commitNote(db),
		getNotes: getNotes(db),
		getStock: getStock(db),
		getWarehouses: getWarehouses(db)
	})
};
