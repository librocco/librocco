/* eslint-disable @typescript-eslint/no-explicit-any */
import { concat, from, map, Observable, switchMap, tap } from 'rxjs';

import { debug } from '@librocco/shared';

import { CouchDocument, VersionedString } from '../types';

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
export const unwrapDocs = (res: PouchDB.Core.AllDocsResponse<Record<string, any> & Pick<CouchDocument, 'docType'>>) =>
	res.rows.reduce((acc, { doc }) => {
		if (!doc) {
			return acc;
		}
		return [...acc, { ...doc, _id: doc._id as VersionedString }];
	}, [] as CouchDocument[]);

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
const newChangeEmitter = <M extends Record<string, unknown> = Record<string, unknown>>(
	db: PouchDB.Database,
	id: string
) =>
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

const newChangesStream = <Model extends Record<any, any>>(emitter: PouchDB.Core.Changes<Model>, ctx: debug.DebugCtx) =>
	new Observable<PouchDB.Core.ChangesResponseChange<Model>>((subscriber) => {
		emitter.on('change', (change) => {
			debug.log(ctx, 'changes_stream:change')(change);
			subscriber.next(change);
		});
	});

/**
 * A function that handles replication, returns resolve when replication is complete and reject otherwise
 * @param local - local pouchdb instance
 * @param remote - remote pouchdb instance
 */

export const replicate = (database: { remote: string; local: PouchDB.Database }) =>
	new Promise<void>((resolve, reject) => {
		database.local.replicate
			.to(database.remote)
			.on('complete', function () {
				// after unidirectional replication is done, initiate live syncing (bidirectional)
				console.log('Replication complete');

				database.local
					.sync(database.remote, { live: true, retry: true })
					.on('change', function (info) {
						// handle change
						console.log({ info });
					})
					.on('paused', function () {
						// replication paused (e.g. user went offline)
					})
					.on('active', function () {
						// replicate resumed (e.g. user went back online)
					})
					.on('denied', function (info) {
						// a document failed to replicate, e.g. due to permissions
						console.log({ info });
					})
					.on('complete', function (info) {
						// handle complete
						console.log({ info });
					})
					.on('error', function (err) {
						// handle error
						console.log({ err });
					});

				resolve();
			})
			.on('error', function (err) {
				// boo, something went wrong!
				console.log('could not replicate to remote db', err);
				reject();
			});
	});
