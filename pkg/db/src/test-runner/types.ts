/* eslint-disable @typescript-eslint/no-namespace */
/* eslint-disable @typescript-eslint/no-empty-function */

import { DatabaseInterface, VolumeStock, NoteType, VersionedString, VersionString } from "@/types";

// #region rawData
interface IndustryIdentifier {
	type: "ISBN_10" | "ISBN_13";
	identifier: string;
}

export interface RawBook {
	volumeInfo: {
		title: string;
		authors: string[];
		publisher: string;
		publishedDate: string;
		industryIdentifiers: IndustryIdentifier[];
		categories: string[];
		language: string;
	};
}
export interface RawBookStock extends RawBook {
	warehouseId: string;
	quantity: number;
}

export interface RawNote {
	id: string;
	type: "in-note" | "out-note";
	books: RawBookStock[];
}

export interface RawSnap {
	id: string;
	books: RawBookStock[];
}
// #endregion rawData

// #region runner
export interface TestDataLoader {
	getNotes: () => Promise<RawNote[]>;
	getSnaps: () => Promise<RawSnap[]>;
}
// #endregion runner

// #region testSetup
interface TestNote {
	id: VersionedString;
	type: NoteType;
	books: VolumeStock[];
}
export interface TransformNote {
	(version: VersionString): (note: RawNote) => TestNote;
}

export interface TestStock {
	id: string;
	books: VolumeStock[];
}
export interface TransformStock {
	(version: VersionString): (db: RawSnap) => TestStock;
}

export interface MapWarehouses {
	(version: VersionString): (books: RawBookStock[]) => TestStock[];
}

export interface GetNotesAndWarehouses {
	(version: VersionString): (n: number) => {
		notes: TestNote[];
		fullStock: TestStock;
		warehouses: TestStock[];
	};
}

export interface TestFunction {
	(db: DatabaseInterface, version: VersionString, getNotesAndWarehouses: GetNotesAndWarehouses): Promise<void>;
}

export interface TestTask {
	(name: string, fn: TestFunction): void;
}

export interface ImplementationSetup {
	version: VersionString;
	newDatabase: (db: PouchDB.Database) => DatabaseInterface;
}
// #endregion testSetup
