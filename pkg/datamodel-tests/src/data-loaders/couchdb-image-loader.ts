/* eslint-disable @typescript-eslint/no-explicit-any */
import PouchDB from 'pouchdb';

import { CouchDocument, RawNote, RawSnap } from '@/types';

import { unwrapDocs } from '@/utils/pouchdb';

export const getNotes = async () => {
	const notesDB = new PouchDB('http://admin:admin@127.0.0.1:5000/raw_notes');
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	const res = await retry(() => notesDB.allDocs({ include_docs: true }), 15, 200);
	return unwrapDocs(res) as CouchDocument<RawNote>[];
};

export const getSnaps = async () => {
	const snapsDB = new PouchDB('http://admin:admin@127.0.0.1:5000/raw_snaps');
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	const res = await retry(() => snapsDB.allDocs({ include_docs: true }), 15, 200);
	return unwrapDocs(res) as CouchDocument<RawSnap>[];
};

/** A convenience method allowing us to use the timeout as 'setTimeout' in async/await manner */
const wait = (timeout: number) => new Promise<void>((resolve) => setTimeout(() => resolve(), timeout));

/**
 * Retry the async function passed as callback a number of times.
 * We're using this to wait for the couchdb container (containing test data) to come online.
 */
const retry = async <CB extends () => Promise<any>>(cb: CB, retries: number, backoff: number): Promise<ReturnType<CB>> => {
	try {
		const res = await cb();
		return res;
	} catch (err) {
		if (!retries) {
			throw 'max number of retries exceeded: ' + err;
		}

		await wait(backoff);
		return retry(cb, retries - 1, backoff);
	}
};
