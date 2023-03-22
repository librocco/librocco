/* eslint-disable @typescript-eslint/no-explicit-any */
import { concat, from, map, Observable, switchMap, tap } from 'rxjs';

import { debug } from '@librocco/shared';

import { CouchDocument } from '../types';

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
export const unwrapDocs = <T extends Record<string, any>>(res: PouchDB.Core.AllDocsResponse<T>): (T | undefined)[] =>
	res.rows.map(({ doc: d }) => {
		if (!d) return undefined;
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const { _id, _rev, ...doc } = d;
		return doc as T;
	});

/**
 * Unwraps a pouch db doc by removing `_rev` field (we use this to compare documents)
 * @param doc pouch db document (including `_rev` and `_id`)
 * @returns the provided document without the `_rev` field (including `_id`)
 */
export const unwrapDoc = (doc: PouchDB.Core.IdMeta & PouchDB.Core.GetMeta): Omit<CouchDocument, '_rev'> => {
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
		since: 'now',
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
export const newDocumentStream = <M extends Record<string, unknown>, R>(
	db: PouchDB.Database,
	id: string,
	selector: (doc?: M) => R = (doc) => doc as R,
	fallbackDoc: M = {} as M,
	ctx: debug.DebugCtx = {}
) =>
	new Observable<R>((subscriber) => {
		// Each subscription creates a new pouchdb change emitter
		// so that we can cancel the emitter when the subscription is cancelled.
		// This allows us to isolate the change emitter to a single subscription and make sure all
		// unused emitters are cancelled from.
		const emitter = newChangeEmitter<M>(db, id);

		const initialPromise = db
			.get<M>(id)
			.then((res) => {
				debug.log(ctx, 'document_stream:initial_query:result')(res);
				return res;
			})
			// This shouldn't really happen, but as an edge case, we don't want to break the entire app
			.catch((err) => {
				debug.log(ctx, 'document_stream:initial_query:error')(err);
				debug.log(ctx, 'document_stream:initial_query:error:fallback')(fallbackDoc);
				return fallbackDoc;
			});
		const initialState = from(initialPromise);
		const changeStream = newChangesStream<M>(emitter, ctx).pipe(
			tap(debug.log(ctx, 'document_stream:change')),
			map(({ doc }) => doc),
			tap(debug.log(ctx, 'document_stream:change:transformed'))
		);

		concat(initialState, changeStream)
			.pipe(
				tap(debug.log(ctx, 'document_stream:result:raw')),
				map(selector),
				tap(debug.log(ctx, 'document_stream:result:transformed'))
			)
			.subscribe((doc) => subscriber.next(doc));

		return () => emitter.cancel();
	});

export const newViewStream = <M extends Record<string, any>, R>(
	db: PouchDB.Database,
	view: string,
	query_params: PouchDB.Query.Options<Record<string, unknown>, M> = {},
	transform: (doc: PouchDB.Query.Response<M>) => R = (rows) => rows as any,
	ctx: debug.DebugCtx
) =>
	new Observable<R>((subscriber) => {
		// Each subscription creates a new pouchdb change emitter
		// so that we can cancel the emitter when the subscription is cancelled.
		// This allows us to isolate the change emitter to a single subscription and make sure all
		// unused emitters are cancelled from.
		const emitter = db.changes<M>({
			since: 'now',
			live: true,
			filter: '_view',
			view
		});

		// Create an initial query to get the initial data
		// (without this, the data would get updated only by changes happening after the subscription)
		const initialQueryPromise = db
			.query<M>(view, query_params)
			// This shouldn't really happen, but as an edge case, we don't want to break the entire app
			.catch((err) => {
				debug.log(ctx, 'view_stream:initial_query:error')(err);
				return { rows: [], total_rows: 0, offset: 0 } as PouchDB.Query.Response<M>;
			})
			.then((res) => {
				debug.log(ctx, 'view_stream:initial_query:result')(res);
				return res;
			});
		const initialQueryStream = from(initialQueryPromise);
		// Create a stream for changes (happening after the subscription)
		const updatesStream = newChangesStream<M>(emitter, ctx).pipe(
			tap(debug.log(ctx, 'view_stream:change')),
			// The change only triggers a new query (as changes are partial and we require the full view update)
			switchMap(() =>
				from(
					new Promise<PouchDB.Query.Response<M>>((resolve) => {
						db.query<M>(view, query_params)
							.then((res) => {
								debug.log(ctx, 'view_stream:change_query:result')(res);
								return resolve(res);
							})
							.catch((err) => {
								debug.log(ctx, 'view_stream:change_query:error')(err);
							});
					})
				)
			)
		);

		// Concatanate the two streams and transform the result
		const resultStream = concat(initialQueryStream, updatesStream).pipe(
			// Transform the result to the desired format
			tap(debug.log(ctx, 'view_stream:result:raw')),
			map(transform),
			tap(debug.log(ctx, 'view_stream:result:transformed'))
		);

		resultStream.subscribe(subscriber);

		return () => {
			debug.log(ctx, 'view_stream:cancel')({});
			return emitter.cancel();
		};
	});

export const newChangesStream = <Model extends Record<any, any>>(emitter: PouchDB.Core.Changes<Model>, ctx: debug.DebugCtx) =>
	new Observable<PouchDB.Core.ChangesResponseChange<Model>>((subscriber) => {
		emitter.on('change', (change) => {
			debug.log(ctx, 'changes_stream:change')(change);
			subscriber.next(change);
		});
	});

interface ReplicateFn<R = Promise<void>> {
	(params: { local: PouchDB.Database; remote: string }, ctx: debug.DebugCtx): R;
}

/**
 * A helper function used to replicate a remote (PouchDB/CouchDB) db to a local PouchDB instance.
 * This is a one time, one way replication used to initialize the local db.
 * It wraps the PouchDB replication API in a promise, resolving when the replication is complete.
 * @param params
 * @param {PouchDB.Database} params.local (local) PouchDB instance we're replicating to
 * @param {string} params.remote address of remote (PouchDB/CouchDB) db we're replicating from (e.g. 'http://localhost:5984/mydb')
 * @returns
 */
export const replicateFromRemote: ReplicateFn = ({ remote, local }, ctx) =>
	new Promise<void>((resolve, reject) => {
		const info = { local: local.name, remote };

		local.replicate
			.from(remote)
			.on('complete', (complete) => {
				// after unidirectional replication is done, initiate live syncing (bidirectional)
				debug.log(ctx, 'replicate_from_remote:complete')({ ...info, complete });
				resolve();
			})
			.on('paused', () => {
				// replication paused (e.g. user went offline)
				debug.log(ctx, 'replicate_live:paused')(info);
			})
			.on('active', function () {
				// replicate resumed (e.g. user went back online)
				debug.log(ctx, 'replicate_live:active')(info);
			})
			.on('denied', (error) => {
				// boo, something went wrong!
				debug.log(ctx, 'replicate_from_remote:error')({ ...info, error });
				reject(error);
			})
			.on('error', (error) => {
				// boo, something went wrong!
				debug.log(ctx, 'replicate_from_remote:error')({ ...info, error });
				reject(error);
			});
	});

/**
 * Open a continuous, bidirectional synchronisation (replication) between a local PouchDB instance and a remote (PouchDB/CouchDB) db.
 * @param params
 * @param {PouchDB.Database} params.local (local) PouchDB instance we're replicating to
 * @param {string} params.remote address of remote (PouchDB/CouchDB) db we're replicating from (e.g. 'http://localhost:5984/mydb')
 * @returns
 */
export const replicateLive: ReplicateFn<void> = ({ remote, local }, ctx) => {
	const info = { local: local.name, remote };

	local
		.sync(remote, { live: true, retry: true })
		.on('change', (change) => {
			// handle change
			debug.log(ctx, 'replicate_live:change')({ ...info, change });
		})
		.on('paused', () => {
			// replication paused (e.g. user went offline)
			debug.log(ctx, 'replicate_live:paused')(info);
		})
		.on('active', () => {
			// replicate resumed (e.g. user went back online)
			debug.log(ctx, 'replicate_live:active')(info);
		})
		.on('denied', (error) => {
			debug.log(ctx, 'replicate_live:denied')({ ...info, error });
		})
		.on('error', (error) => {
			// handle error
			debug.log(ctx, 'replicate_live:error')({ ...info, error });
		})
		.on('complete', (complete) => {
			debug.log(ctx, 'replicate_live:error')({ ...info, complete });
		});
};
