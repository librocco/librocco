/* eslint-disable @typescript-eslint/no-explicit-any */
import { concat, from, map, Observable, switchMap } from 'rxjs';

import { CouchDocument, VersionedString } from '@librocco/db';

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
	selector: (doc: PouchDB.Core.ChangesResponseChange<M>) => R = (doc) => doc.doc as R
) =>
	new Observable<R>((subscriber) => {
		// Each subscription creates a new pouchdb change emitter
		// so that we can cancel the emitter when the subscription is cancelled.
		// This allows us to isolate the change emitter to a single subscription and make sure all
		// unused emitters are cancelled from.
		const emitter = newChangeEmitter<M>(db, id);
		emitter.on('change', (change) => {
			subscriber.next(selector(change));
		});
		return () => emitter.cancel();
	});

export const newViewStream = <M extends Record<string, any>, R>(
	db: PouchDB.Database,
	view: string,
	query_params: PouchDB.Query.Options<Record<string, unknown>, M> = {},
	transform: (doc: PouchDB.Query.Response<M>) => R = (rows) => rows as any
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
		const initialQueryStream = from(db.query<M>(view, query_params));
		// Create a stream for changes (happening after the subscription)
		const updatesStream = newChangesStream<M>(emitter).pipe(
			// The change only triggers a new query (as changes are partial and we require the full view update)
			switchMap(() => from(db.query<M>(view, query_params)))
		);

		// Concatanate the two streams and transform the result
		const resultStream = concat(initialQueryStream, updatesStream).pipe(
			// Transform the result to the desired format
			map(transform)
		);

		resultStream.subscribe(subscriber);

		return () => emitter.cancel();
	});

const newChangesStream = <Model extends Record<any, any>>(emitter: PouchDB.Core.Changes<Model>) =>
	new Observable<PouchDB.Core.ChangesResponseChange<Model>>((subscriber) => {
		emitter.on('change', (change) => {
			subscriber.next(change);
		});
	});
