/* eslint-disable @typescript-eslint/ban-types */
import type { Observable } from "rxjs";
import PouchDB from "pouchdb";

import { NoteState, VolumeStock, VolumeStockKind, debug } from "@librocco/shared";

import type { PrintJobStatus } from "@/enums";

import type {
	DatabaseInterface as BaseDatabaseInterface,
	BookEntry,
	BooksInterface,
	CouchDocument,
	DatabaseInterface,
	PickPartial
} from "./misc";

import { NEW_WAREHOUSE } from "@/constants";

// #region misc
/** An extended version of `VolumeStock`, for client usage (should contain warehouse name as ids are quite ugly to display) */
export type VolumeStockClient<K extends VolumeStockKind = VolumeStockKind> = K extends "custom"
	? VolumeStock<"custom">
	: VolumeStock<K> & {
			warehouseDiscount: number;
			warehouseName: string;
			availableWarehouses?: NavMap<{ quantity: number }>;
	  };

export interface EntriesStreamResult<K extends VolumeStockKind = VolumeStockKind> {
	rows: VolumeStockClient<K>[];
	total: number;
	totalPages: number;
}

export type EntriesQuery = (ctx: debug.DebugCtx) => Promise<Iterable<VolumeStockClient>>;

export interface OutOfStockTransaction extends VolumeStock<"book"> {
	warehouseName: string;
	available: number;
}
// #endregion misc

// #region note
export type NoteType = "inbound" | "outbound";

/**
 * Standardized data that should be present in any note
 * (different implementations might differ, but should extend this structure)
 */
export type NoteData<A extends Record<string, any> = {}> = CouchDocument<
	{
		noteType: NoteType;
		committed: boolean;
		displayName: string;
		updatedAt: string | null;
		reconciliationNote?: boolean;
	} & A
>;

/**
 * A standardized interface for streams received from a note
 */
export interface NoteStream {
	state: (ctx: debug.DebugCtx) => Observable<NoteState>;
	displayName: (ctx: debug.DebugCtx) => Observable<string>;
	defaultWarehouseId: (ctx: debug.DebugCtx) => Observable<string>;
	autoPrintLabels(ctx: debug.DebugCtx): Observable<boolean>;
	updatedAt: (ctx: debug.DebugCtx) => Observable<Date | null>;
	entries: (ctx: debug.DebugCtx, page?: number, itemsPerPage?: number) => Observable<EntriesStreamResult>;
}

export type UpdateTransactionParams<K extends VolumeStockKind = VolumeStockKind> = K extends "custom"
	? [id: string, update: PickPartial<VolumeStock<"custom">, "id">]
	: [match: PickPartial<Omit<VolumeStock<"book">, "quantity">, "warehouseId">, update: VolumeStock<"book">];

/**
 * A standardized interface (interface of methods) for a note.
 * Different implementations might vary, but should always extend this interface.
 */
export interface NoteProto<A extends Record<string, any> = {}> {
	// CRUD
	create(): Promise<NoteInterface<A>>;
	get(): Promise<NoteInterface<A> | undefined>;
	// NOTE: update is private
	delete(ctx: debug.DebugCtx): Promise<void>;

	// Note specific methods
	/** Set name updates the `displayName` of the note. */
	setName(ctx: debug.DebugCtx, name: string): Promise<NoteInterface<A>>;
	/** Updates the `defaultWarehouse` of the note. */
	setDefaultWarehouse(ctx: debug.DebugCtx, warehouseId: string): Promise<NoteInterface<A>>;
	/**
	 * Marks the note as a 'reconciliationNote' - an inbound note used to reconcile the state
	 * in case an outbound note contains some out-of-stock books (but they exist in physical state).
	 */
	setReconciliationNote: (ctx: debug.DebugCtx, value: boolean) => Promise<NoteInterface<A>>;
	/**
	 * Add volumes accepts an array of volume stock entries and adds them to the note.
	 * If any transactions (for a given isbn and warehouse) already exist, the quantity gets aggregated.
	 */
	addVolumes(
		...params: Array<PickPartial<VolumeStock<"custom">, "id"> | PickPartial<VolumeStock<"book">, "warehouseId">>
	): Promise<NoteInterface<A>>;
	/**
	 * Explicitly update an existing transaction row.
	 * The transaction is matched by both isbn and warehouseId.
	 */
	updateTransaction(ctx: debug.DebugCtx, ...params: UpdateTransactionParams<"book">): Promise<NoteInterface<A>>;
	updateTransaction(ctx: debug.DebugCtx, ...params: UpdateTransactionParams<"custom">): Promise<NoteInterface<A>>;
	/**
	 * Remove "row" from note transactions .
	 * The transaction is matched by both isbn and warehouseId.
	 */
	removeTransactions(
		...transactions: Array<VolumeStock<"custom">["id"] | Omit<VolumeStock<"book">, "quantity">>
	): Promise<NoteInterface<A>>;
	/**
	 * Commit the note, no updates to the note (except updates to `displayName`) can be performed after this.
	 * @param ctx debug context
	 * @param options object
	 * @param options.force force commit, even if the note is empty (this should be used only in tests)
	 */
	commit(ctx: debug.DebugCtx, options?: { force: true }): Promise<NoteInterface<A>>;
	/**
	 * Stream returns an object containing observable streams for the note:
	 * - `state` - streams the note's `state`
	 * - `displayName` - streams the note's `displayName`
	 * - `updatedAt` - streams the note's `updatedAt`
	 * - `entries` - streams the note's `entries` (volume transactions)
	 */
	stream(): NoteStream;
	/**
	 * An imperative query (single response) of note's transactions (as opposed to the entries stream - an observable stream).
	 */
	getEntries: EntriesQuery;
	/**
	 * Creates a receipt object (of ReceiptData type) for printing. Doesn't do the actual printing.
	 */
	intoReceipt(): Promise<ReceiptData>;
	/**
	 * For outbound notes: this function reconciles the missing stock (in the outbound note) by creating new inbound note(s), in the
	 * background, and committing those before committing the outbound note so that the resulting for each entry will at least be 0 (no negative quantities).
	 */
	reconcile: (ctx: debug.DebugCtx) => Promise<NoteInterface<A>>;

	/**
	 * Enable printing of labels on each scan.
	 */
	setAutoPrintLabels(ctx: debug.DebugCtx, value: boolean): Promise<NoteInterface<A>>;
}

/**
 * A (standardized) full note interface:
 * * standard data structure
 * * standard method interface
 */
export type NoteInterface<A extends Record<string, any> = {}> = NoteProto<A> & NoteData<A>;
// #endregion note

// #region warehouse
/**
 * Standardized data that should be present in any note
 * (different implementations might differ, but should extend this structure)
 */
export type WarehouseData<A extends Record<string, any> = {}> = CouchDocument<
	{
		displayName: string;
		discountPercentage: number;
	} & A
>;

/**
 * A standardized interface for streams received from a warehouse
 */
export interface WarehouseStream {
	displayName: (ctx: debug.DebugCtx) => Observable<string>;
	discount: (ctx: debug.DebugCtx) => Observable<number>;
	entries: (ctx: debug.DebugCtx, page?: number, itemsPerPage?: number) => Observable<EntriesStreamResult<"book">>;
}

/**
 * A standardized interface (interface of methods) for a warehouse.
 * Different implementations might vary, but should always extend this interface.
 */
export interface WarehouseProto<N extends NoteInterface = NoteInterface, A extends Record<string, any> = {}> {
	// CRUD
	create: () => Promise<WarehouseInterface<N, A>>;
	get: () => Promise<WarehouseInterface<N, A> | undefined>;
	// NOTE: update is private
	delete: () => Promise<void>;

	/** Note constructs a note interface for the note with the provided id. If ommitted, a new (timestamped) id is generated (for note creation). */
	note: (id?: string) => N;
	/** Set name udpates the `displayName` of the warehouse */
	setName: (ctx: debug.DebugCtx, name: string) => Promise<WarehouseInterface<N, A>>;
	/**
	 * Set discount percentage to be applied to original book prices for all books belonging to the particular warehouse.
	 * @param ctx debug context
	 * @param discountPercentage discount percentage as two digit integer, e.g. 20 for 20% discount
	 */
	setDiscount: (ctx: debug.DebugCtx, discountPercentage: number) => Promise<WarehouseInterface<N, A>>;
	/**
	 * Stream returns an object containing observable streams for the warehouse:
	 * - `displayName` - streams the warehouse's `displayName`
	 * - `entries` - streams the warehouse's `entries` (stock)
	 */
	stream: () => WarehouseStream;
	/**
	 * An imperative query (single response) of warehouse stock (as opposed to the entries stream - an observable stream).
	 */
	getEntries: EntriesQuery;
}

/**
 * A (standardized) full warehouse interface:
 * * standard data structure
 * * standard method interface
 */
export type WarehouseInterface<N extends NoteInterface = NoteInterface, A extends Record<string, any> = {}> = WarehouseProto<N, A> &
	WarehouseData<A>;
// #endregion warehouse

// #region receipts
export interface ReceiptItem {
	// Custom items have no isbn
	isbn?: string;
	title: string;
	quantity: number;
	price: number;
	discount: number;
}

export interface ReceiptData {
	items: ReceiptItem[];
	timestamp: number;
}

export interface PrintJob extends CouchDocument<ReceiptData> {
	printer_id: string;
	// TODO: Update the states when developing the functionality further
	status: PrintJobStatus;
	error?: string;
}

export interface PrinterInterface {
	label(): { print(book: BookEntry): Promise<Response> };
	receipt(): { print(items: ReceiptItem[]): Promise<Response> };
}
// #endregion receipts

// #region db
export type NavEntry<A = {}> = {
	displayName: string;
	updatedAt?: Date;
	totalBooks?: number;
} & A;

/**
 * A map of navigation entries: { noteId => { displayName } }
 */
export type NavMap<A = {}> = Map<string, NavEntry<A>>;
/**
 * A map of warehouses and their respective data
 */
export type WarehouseDataMap = NavMap<Pick<WarehouseData, "displayName" | "discountPercentage">>;

/**
 * A map of inbound note entries: { warehouseId => { displayName, notes: NavMap } }
 */
export type InNoteMap = NavMap<{ notes: NavMap }>;

export interface NoteLookupResult<N extends NoteInterface, W extends WarehouseInterface> {
	note: N;
	warehouse: W;
}

export interface FindNote<N extends NoteInterface, W extends WarehouseInterface> {
	(noteId: string): Promise<NoteLookupResult<N, W> | undefined>;
}

/**
 * A standardized interface for streams received from a db
 */
export interface DbStream {
	warehouseMap: (ctx: debug.DebugCtx) => Observable<WarehouseDataMap>;
	outNoteList: (ctx: debug.DebugCtx) => Observable<NavMap>;
	inNoteList: (ctx: debug.DebugCtx) => Observable<InNoteMap>;

	labelPrinterUrl: (ctx: debug.DebugCtx) => Observable<string>;
	receiptPrinterUrl: (ctx: debug.DebugCtx) => Observable<string>;
}

/**
 * A standardized interface (interface of methods) for a db.
 */
export type InventoryDatabaseInterface<
	W extends WarehouseInterface = WarehouseInterface,
	N extends NoteInterface = NoteInterface
> = BaseDatabaseInterface<{
	/**
	 * Books constructs an interface used for book operations agains the db:
	 * - `get` - accepts an array of isbns and returns a same length array of book data or `undefined`.
	 * - `upsert` - accepts an array of book data and upserts them into the db. If a book data already exists, it will be
	 * updated, otherwise it will be created.
	 * - `stream` - accepts an array of isbns and returns a stream, streaming an array of same length, containing book data or `undefined`.
	 */
	books: () => BooksInterface;
	/**
	 * Warehouse returns a warehouse interface for a given warehouse id.
	 * If no id is provided, it falls back to the default (`0-all`) warehouse.
	 *
	 * To assign a new unique id to the warehouse, use `NEW_WAREHOUSE` as the id.
	 * @example
	 * ```ts
	 * import { NEW_WAREHOUSE } from '@librocco/db';
	 * const newWarehouse = db.warehouse(NEW_WAREHOUSE);
	 * ```
	 */
	warehouse: (id?: string | typeof NEW_WAREHOUSE) => W;
	/**
	 * Find note accepts a note id and returns:
	 * - if note exists: the note interface and warehouse interface for its parent warehouse
	 * - if note doesn't exist: `undefined`
	 */
	findNote: FindNote<N, W>;
	/**
	 * Stream returns an object containing note streams:
	 * - `warehouseList` - a stream of warehouse list entries (for navigation)
	 * - `outNoteList` a stream of out note list entries (for navigation)
	 * - `inNoteList` - a stream of in note list entries (for navigation)
	 */
	stream: () => DbStream;
	printer(): PrinterInterface;
	setLabelPrinterUrl(url: string): DatabaseInterface;
	setReceiptPrinterUrl(url: string): DatabaseInterface;
}>;

export interface NewDatabase {
	(db: PouchDB.Database): InventoryDatabaseInterface;
}
// #endregion db
