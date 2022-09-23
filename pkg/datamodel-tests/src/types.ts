/* eslint-disable @typescript-eslint/no-empty-function */
/* eslint-disable @typescript-eslint/no-explicit-any */

// #region misc
export type CouchDocument<Doc extends Record<string, any> = Record<string, any>> = {
	_id: string;
} & Doc;
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

export interface TransformBook {
	(book: RawBook): CouchDocument;
}

export interface TransformNote {
	(note: RawNote): CouchDocument;
}

export interface AddToWarehouse {
	(wName: string, book: RawBookStock): void;
}

export interface TransformSnap {
	(db: RawSnap): CouchDocument;
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
// #endregion runner
