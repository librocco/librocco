/* eslint-disable @typescript-eslint/no-namespace */
/* eslint-disable @typescript-eslint/no-empty-function */

import { DatabaseInterface, VolumeStock, NoteType, VersionString } from "@/types";

// #region rawData
export interface RawNote {
	id: string;
	type: NoteType;
	books: VolumeStock[];
}

export interface RawSnap {
	id: string;
	books: VolumeStock[];
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
	id: string;
	type: NoteType;
	books: VolumeStock[];
}

export interface TestStock {
	id: string;
	books: VolumeStock[];
}

export interface MapWarehouses {
	(books: VolumeStock[]): TestStock[];
}

export interface GetNotesAndWarehouses {
	(n: number): {
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
