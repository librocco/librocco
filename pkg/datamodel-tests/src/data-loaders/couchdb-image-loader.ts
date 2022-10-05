import PouchDB from 'pouchdb';

import { CouchDocument, RawNote, RawSnap } from '@/types';

import { unwrapDocs } from '@/utils/pouchdb';

export const getNotes = async () => {
	const notesDB = new PouchDB('http://admin:admin@127.0.0.1:5000/raw_notes');
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	const res = await notesDB.allDocs({ include_docs: true });
	return unwrapDocs(res) as CouchDocument<RawNote>[];
};

export const getSnaps = async () => {
	const snapsDB = new PouchDB('http://admin:admin@127.0.0.1:5000/raw_snaps');
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	const res = await snapsDB.allDocs({ include_docs: true });
	return unwrapDocs(res) as CouchDocument<RawSnap>[];
};
