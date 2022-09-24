/* eslint-disable @typescript-eslint/no-namespace */
/* eslint-disable @typescript-eslint/no-empty-function */
/* eslint-disable @typescript-eslint/no-explicit-any */

// #region misc
export type CouchDocument<Doc extends Record<string, any> = Record<string, any>> = {
	_id: string;
} & Doc;

export type DesignDocument = {
	_id: `_design/${string}`;
	views: Record<string, { map: string; reduce?: string }>;
};
// #endregion misc

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
	getBooks: () => Promise<RawBook[]>;
	getNotes: () => Promise<RawNote[]>;
	getSnaps: () => Promise<RawSnap[]>;
}
// #endregion runner

// #region testSetup
export interface TransformBook<S extends Record<string, any> = Record<string, any>> {
	(book: RawBook): CouchDocument<S>;
}

export interface TransformNote<S extends Record<string, any> = Record<string, any>> {
	(note: RawNote): CouchDocument<S>;
}

export interface AddToWarehouse {
	(wName: string): void;
}

export interface TransformSnap<S extends Record<string, any> = Record<string, any>> {
	(db: RawSnap): CouchDocument<S>;
}

export interface MapWarehouses {
	(book: RawBookStock, addToWarehouse: AddToWarehouse): void;
}

export interface TransformConfig {
	transformBooks?: TransformBook;
	transformNotes?: TransformNote;
	transformSnaps?: TransformSnap;
	mapWarehouses?: MapWarehouses;
	transformWarehouse?: TransformSnap;
}

export interface DBInteraction<R = void, P extends any[] = never[]> {
	(...params: P): Promise<R>;
}
export interface DBInteractionHOF<R = void, P extends any[] = never[]> {
	(db: PouchDB.Database): DBInteraction<R, P>;
}

export interface DBInterface {
	commitNote: DBInteraction<void, [CouchDocument]>;
	getNotes: DBInteraction<CouchDocument[]>;
	getStock: DBInteraction<CouchDocument>;
	getWarehouses: DBInteraction<CouchDocument[]>;
}

export interface CreateDBInterface {
	(db: PouchDB.Database): DBInterface;
}

export interface TestSetup {
	transform: TransformConfig;
	designDocuments?: DesignDocument[];
	createDBInterface: CreateDBInterface;
}

export interface GetNotesAndWarehouses {
	(n: number): {
		notes: CouchDocument[];
		snap: CouchDocument;
		warehouses: CouchDocument[];
	};
}

interface TestData {
	books: CouchDocument[];
	getNotesAndWarehouses: GetNotesAndWarehouses;
}

export interface TestFunction {
	(data: TestData, db: DBInterface): Promise<void>;
}

export interface Test {
	(name: string, fn: TestFunction): void;
}
// #endregion testSetup
