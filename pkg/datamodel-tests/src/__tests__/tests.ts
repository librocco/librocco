import { expect } from 'vitest';

import { TestFunction, DesignDocument, CouchDocument } from '@/types';

import { addBooksToNote, commitNote, deleteNotes, explicitlySetVolumeStock } from '@/tests';

// A smoke test for uploading the design documents
const uploadDesignDocuments: TestFunction = async (db) => {
	// The 'docs/count' is used as a smoke test to validate 'db.updateDesignDoc'
	const docsCount: DesignDocument = {
		_id: '_design/docs',
		views: {
			count: {
				map: function (doc: CouchDocument) {
					emit(doc._id);
				}.toString(),
				reduce: '_count'
			}
		}
	};

	await db.updateDesignDoc(docsCount);

	const w = db.warehouse();
	await Promise.all([w.createInNote(), w.createInNote()]);

	const res = await db._pouch.query('docs/count', { reduce: true });
	const nDocs = res.rows[0].value;

	expect(nDocs).toEqual(2);
};

// We're running unit tests on a subset of final, full tests (for different datamodels)
export default {
	addBooksToNote,
	commitNote,
	deleteNotes,
	explicitlySetVolumeStock,
	uploadDesignDocuments
};
