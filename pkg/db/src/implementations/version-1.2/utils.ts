import { concat, from, map, Observable, tap } from "rxjs";

import { map as mapIter, StockMap, debug, VolumeStock } from "@librocco/shared";

import { CouchDocument, DesignDocument } from "./types";

import { EntriesStreamResult, NavMap, VolumeStockClient, WarehouseDataMap } from "@/types";

import { VersionedString, VersionString } from "./types";

export const isVersioned = (id: string, versionString: VersionString): id is VersionedString => id.startsWith(`${versionString}/`);
export const versionId = (id: string): VersionedString => (isVersioned(id, "v1") ? id : `v1/${id}`);

export type TableData = {
	/** Rows to display for a page */
	rows: Iterable<VolumeStock>;
	total: number;
};

type Params = [TableData, WarehouseDataMap, ...any[]];
type ParamsWithAvailableWarehouses = [TableData, WarehouseDataMap, StockMap];

export function combineTransactionsWarehouses(opts: {
	includeAvailableWarehouses: true;
}): (params: ParamsWithAvailableWarehouses) => EntriesStreamResult;
export function combineTransactionsWarehouses(opts?: { includeAvailableWarehouses: boolean }): (params: Params) => EntriesStreamResult;
export function combineTransactionsWarehouses(opts?: { includeAvailableWarehouses: boolean }) {
	return opts?.includeAvailableWarehouses
		? ([{ rows, total }, warehouses, stock]: ParamsWithAvailableWarehouses): EntriesStreamResult => ({
				total,
				rows: [...addAvailableWarehouses(addWarehouseData(rows, warehouses), warehouses, stock)]
			})
		: ([{ rows, total }, warehouses]: Params): EntriesStreamResult => ({
				total,
				rows: [...addWarehouseData(rows, warehouses)]
			});
}

/**
 * Takes in a list of VolumeStock entries and a list of existing warehouses and adds a `warehouseName` field (with respect to warehouseId) to each entry.
 *
 * @param entries
 * @param warehouses
 * @returns
 */
export const addWarehouseData = (entries: Iterable<VolumeStock>, warehouses: WarehouseDataMap): Iterable<VolumeStockClient> => {
	return mapIter(entries, (e) => {
		// Custom items don't require additional processing
		if (e.__kind === "custom") {
			return e;
		}

		// Add additional data to book rows
		return {
			...e,
			__kind: "book",
			warehouseName: warehouses.get(e.warehouseId)?.displayName || "not-found",
			warehouseDiscount: warehouses.get(e.warehouseId)?.discountPercentage || 0
		};
	});
};

/**
 * Takes in a list of VolumeStockClient entries and a list of existing warehouses and a stockMap and adds an `availableWarehouses` field to each entry (omitting the default warehouse).
 *
 * @param entries
 * @param warehouses
 * @param stock
 * @returns
 */
export const addAvailableWarehouses = (
	entries: Iterable<VolumeStockClient>,
	warehouses: NavMap,
	stock: StockMap
): Iterable<VolumeStockClient> => {
	return mapIter(entries, (e) => {
		// Custom items don't have a warehouse related data attached to them
		if (e.__kind === "custom") {
			return e;
		}

		const availableWarehouses: NavMap<{ quantity: number }> = new Map(
			mapIter(stock.isbn(e.isbn), ([[, warehouseId], { quantity = 0 }]) => [
				warehouseId,
				{ displayName: warehouses.get(warehouseId)?.displayName || "not-found", quantity }
			])
		);
		return { ...e, availableWarehouses };
	});
};

/**
 * Takes in a response from the `PouchDB.allDocs`, maps through the
 * "rows" and extracts `doc` from each row. If the `doc` doesn't exist,
 * the entry is omitted from the result.
 *
 * _note: in order for this to work, `include_docs` option should be passed to
 * the pouchdb query._
 * @param res a result received from `PouchDB.allDocs({...options, include_docs: true})`
 * @returns and array of `doc` entries from each pouchdb "row", (including `_id` and `_rev`)
 */
export const unwrapDocs = <T extends Record<string, any>>(res: PouchDB.Core.AllDocsWithKeysResponse<T>): (T | undefined)[] =>
	res.rows.map((row) => {
		if (!(row as any).doc) return undefined;
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const { _id, _rev, ...doc } = (row as any).doc;
		return doc as T;
	});

/**
 * Unwraps a pouch db doc by removing `_rev` field (we use this to compare documents)
 * @param doc pouch db document (including `_rev` and `_id`)
 * @returns the provided document without the `_rev` field (including `_id`)
 */
export const unwrapDoc = (doc: PouchDB.Core.IdMeta & PouchDB.Core.GetMeta): Omit<CouchDocument, "_rev"> => {
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	const { _rev, ...document } = doc;
	return document;
};

/**
 * Compare function used as a callback to `.sort` function, sorts couchdb documents by `_id` in
 * ascending order. CouchDb does this by default, so this is used only to prepare test data for assertions.
 */
export const sortById = ({ _id: id1 }: CouchDocument, { _id: id2 }: CouchDocument) => (id1 < id2 ? -1 : 1);

/**
 * New change emitter creates a new pouchdb `changes` emitter for a given document id.
 * @param db pouchdb instance
 * @param id document id
 */
const newChangeEmitter = <M extends Record<string, unknown> = Record<string, unknown>>(db: PouchDB.Database, id: string) =>
	db.changes<M>({
		since: "now",
		live: true,
		include_docs: true,
		filter: (doc) => doc._id === id
	});

/**
 * New document stream is a helper function that creates a new observable stream
 * for a given document. Whenever the document changes, it will be passed to a selector (optional) and the result will be streamed to a subscriber.
 * If no selector is provided, it falls back to an identity function.
 * @param db pouchdb instance
 * @param id document id
 * @param selector optional selector function
 */
export const newDocumentStream = <M extends Record<string, any>>(
	ctx: debug.DebugCtx,
	db: PouchDB.Database,
	id: string,
	fallbackDoc: M = {} as M
) =>
	new Observable<M>((subscriber) => {
		// Each subscription creates a new pouchdb change emitter
		// so that we can cancel the emitter when the subscription is cancelled.
		// This allows us to isolate the change emitter to a single subscription and make sure all
		// unused emitters are cancelled from.
		const emitter = newChangeEmitter<M>(db, id);

		const initialPromise = db
			.get<M>(id)
			.then((res) => {
				debug.log(ctx, "document_stream:initial_query:result")(res);
				return res;
			})
			// This shouldn't really happen, but as an edge case, we don't want to break the entire app
			.catch((err) => {
				debug.log(ctx, "document_stream:initial_query:error")(err);
				debug.log(ctx, "document_stream:initial_query:error:fallback")(fallbackDoc);
				return fallbackDoc;
			});
		const initialState = from(initialPromise);
		const changeStream = newChangesStream<M>(ctx, emitter).pipe(
			tap(debug.log(ctx, "document_stream:change")),
			map(({ doc }) => doc),
			tap(debug.log(ctx, "document_stream:change:transformed"))
		);

		concat(initialState, changeStream)
			.pipe(tap(debug.log(ctx, "document_stream:result")))
			.subscribe((doc) => subscriber.next(doc));

		return () => emitter.cancel();
	});
export const newViewChangesEmitter = <Model extends Record<any, any>>(db: PouchDB.Database, view: string) =>
	db.changes<Model>({
		since: "now",
		live: true,
		filter: "_view",
		view
	});

export const newChangesStream = <Model extends Record<any, any>>(ctx: debug.DebugCtx, emitter: PouchDB.Core.Changes<Model>) =>
	new Observable<PouchDB.Core.ChangesResponseChange<Model>>((subscriber) => {
		emitter.on("change", (change) => {
			debug.log(ctx, "changes_stream:change")(change);
			subscriber.next(change);
		});
		return () => emitter.cancel();
	});

export const scanDesignDocuments = (docs: DesignDocument[]) => {
	return docs.flatMap(({ _id, views }) => {
		// Remove the "_design/" prefix from the id (the rest is used to prefix each view)
		const prefix = _id.replace(/_design\//, "");
		const view_names = Object.keys(views).map((view_name) => `${prefix}/${view_name}`);
		return view_names;
	});
};
