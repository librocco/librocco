import PouchDB from "pouchdb";

import { RawNote, RawSnap } from "@test-runner/types";

import { unwrapDocs } from "@/utils/pouchdb";

export const getNotes = async () => {
	const notesDB = new PouchDB("http://admin:admin@localhost:5000/notes");
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	const res = await retry(() => notesDB.allDocs<RawNote>({ include_docs: true }), 15, 200);
	return unwrapDocs(res).filter((n) => n !== undefined) as RawNote[];
};

export const getSnaps = async () => {
	const snapsDB = new PouchDB("http://admin:admin@localhost:5000/snaps");
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	const res = await retry(() => snapsDB.allDocs<RawSnap>({ include_docs: true }), 15, 500);
	return unwrapDocs(res).filter((n) => n !== undefined) as RawSnap[];
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
			throw "max number of retries exceeded: " + err;
		}

		await wait(backoff);
		return retry(cb, retries - 1, backoff);
	}
};
