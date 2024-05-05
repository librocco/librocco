import PouchDB from "pouchdb";

import { VolumeStock } from "@librocco/shared";

import { unwrapDocs } from "@/utils/pouchdb";
import { sortBooks } from "@/utils/misc";

export type NoteType = "inbound" | "outbound";

export interface RawNote {
	id: string;
	type: NoteType;
	books: VolumeStock<"book">[];
}

export interface RawSnap {
	id: string;
	books: VolumeStock<"book">[];
}

export interface TestNotesAndWarehouses {
	notes: RawNote[];
	fullStock: RawSnap;
	warehouses: RawSnap[];
}

const getNotes = async () => {
	const notesDB = new PouchDB("http://admin:admin@localhost:5000/notes");
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	const res = await retry(() => notesDB.allDocs<RawNote>({ include_docs: true }), 15, 200);
	return unwrapDocs(res).filter((n) => n !== undefined) as RawNote[];
};

const getSnaps = async () => {
	const snapsDB = new PouchDB("http://admin:admin@localhost:5000/snaps");
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	const res = await retry(() => snapsDB.allDocs<RawSnap>({ include_docs: true }), 15, 500);
	return unwrapDocs(res).filter((n) => n !== undefined) as RawSnap[];
};

const mapWarehouses = (books: VolumeStock<"book">[]): RawSnap[] => {
	const warehousesObject = books.reduce((acc, b) => {
		const { warehouseId } = b;
		const warehouse = acc[warehouseId] || ({ id: warehouseId, books: [] } as RawSnap);

		return {
			...acc,
			[warehouseId]: {
				...warehouse,
				books: [...warehouse.books, b].sort(sortBooks)
			}
		};
	}, {} as Record<string, RawSnap>);

	return Object.values(warehousesObject);
};

const newInventoryDataLoader = () => {
	const _data = Promise.all([getNotes(), getSnaps()]).then(([notes, snaps]) => ({ notes, snaps }));

	const load = async () => {
		await _data;
	};

	const getNotesAndWarehouses = async (n: number): Promise<TestNotesAndWarehouses> => {
		const data = await _data;
		const notes = data.notes.slice(0, n);

		const fullStock = data.snaps[n - 1];

		const warehouses = mapWarehouses(fullStock.books);

		return { notes, fullStock, warehouses };
	};

	return {
		load,
		getNotesAndWarehouses
	};
};

// #region utils
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
// #endregion utils

export default newInventoryDataLoader;
