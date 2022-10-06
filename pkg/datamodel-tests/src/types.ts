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

// #region utils
/**
 * Used to make one or more properties on the object optional.
 */
export type PickPartial<R extends Record<string, any>, K extends keyof R> = Omit<R, K> &
	Partial<Pick<R, K>>;
// #endregion utils

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
	books: (VolumeStock & { warehouse: string })[];
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

// #region standard_api
export type NoteType = 'inbound' | 'outbound';

export interface VolumeStock {
	isbn: string;
	quantity: number;
	warehouse: string;
}
export type VolumeTransactionTuple = [string, number, string] | [string, number];

export interface NoteProto<A extends Record<string, any> = Record<string, any>> {
	addVolumes(
		...params: VolumeTransactionTuple | VolumeTransactionTuple[]
	): Promise<NoteInterface<A>>;
	setVolumeQuantity(isbn: string, quantity: number): Promise<NoteInterface<A>>;
	delete(): Promise<void>;
	commit(): Promise<NoteInterface<A>>;
}
export type NoteData<A extends Record<string, any> = Record<string, any>> = {
	_id: string;
	type: NoteType;
} & A;

export type NoteInterface<A extends Record<string, any> = Record<string, any>> = NoteProto<A> &
	NoteData<A>;

export interface WarehouseProto<N extends NoteInterface<any> = NoteInterface> {
	createInNote(): Promise<N>;
	createOutNote(): Promise<N>;
	getNotes(): Promise<N[]>;
	getNote(id: string): Promise<N>;
	updateNote(note: N): Promise<N>;
	deleteNote(note: N): Promise<void>;
	getStock(): Promise<VolumeStock[]>;
}
export type WarehouseData<A extends Record<string, any> = Record<string, any>> = {
	name: string;
} & A;

export type WarehouseInterface<
	N extends NoteInterface = NoteInterface,
	D extends Record<string, any> = Record<string, any>
> = WarehouseProto<NoteInterface<N>> & WarehouseData<D>;

export interface DatabaseProto<W extends WarehouseInterface> {
	_pouch: PouchDB.Database;
	warehouse(name?: string): W;
	updateDesignDoc(doc: DesignDocument): Promise<PouchDB.Core.Response>;
	destroy(): Promise<void>;
}

export type DatabaseInterface<
	N extends NoteInterface = NoteInterface,
	D extends Record<string, any> = Record<string, any>
> = DatabaseProto<WarehouseInterface<N, D>>;
// #endregion standard_api
