/* eslint-disable @typescript-eslint/no-namespace */
/* eslint-disable @typescript-eslint/no-empty-function */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { DatabaseInterface, VolumeStock, NoteType, DesignDocument } from '@librocco/db';

// #region rawData
interface IndustryIdentifier {
	type: 'ISBN_10' | 'ISBN_13';
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
	warehouse: string;
	quantity: number;
}

export interface RawNote {
	id: string;
	type: 'in-note' | 'out-note';
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
	id: string;
	type: NoteType;
	books: VolumeStock[];
}
export interface TransformNote {
	(note: RawNote): TestNote;
}

export interface TestStock {
	id: string;
	books: VolumeStock[];
}
export interface TransformStock {
	(db: RawSnap): TestStock;
}

export interface MapWarehouses {
	(books: RawBookStock[]): TestStock[];
}

export interface GetNotesAndWarehouses {
	(n: number): {
		notes: TestNote[];
		fullStock: TestStock;
		warehouses: TestStock[];
	};
}

export interface TestFunction {
	(db: DatabaseInterface, getNotesAndWarehouses: GetNotesAndWarehouses): Promise<void>;
}

export interface TestTask {
	(name: string, fn: TestFunction): void;
}

export interface ImplementationSetup {
	newDatabase: (db: PouchDB.Database) => DatabaseInterface;
	designDocuments?: DesignDocument[];
}
// #endregion testSetup
