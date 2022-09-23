import { CouchDocument, CreateDBInterface, DBInteractionHOF, DBInterface } from 'src/types';

/**
 * Creates a HOF returning `commitNote` database interaction. It works the same way as if
 * writing a HOF directly, but serves as a type wrapper as we might (in our `commitNote`) expect
 * a certain note type (which extends `CouchDocument`), but for compatibility with the test runner,
 * the `commitNote` should accept the most generic `CouchDocument`.
 *
 * This helper is here to accept the HOF we want to create, with the note type specified for internal use
 * and returns the same HOF, but cast with the generic `CouchDocument` as a param, for compatibility with the test runner.
 *
 * It accepts a type param, which is then passed internally to give us the checking/intellisence while writing the function.
 *
 * @example
 * ```typescript
 * type Note = CouchDocument<{type: string}>
 *
 * const commitNote = createCommitNote<Note>(
 *      (db) =>
 *      (note) => { // <- note here is typed as Note, declared above, for internal usage
 *          // ...commit functionality
 *      }
 *  )
 * // The resulting commitNote ^^^ accepts any CouchDocument as note param,
 * // and is, thus, compatible with the test runner.
 * ```
 */
export const createCommitNote =
	<I extends CouchDocument>(
		fn: DBInteractionHOF<void, [I]>
	): DBInteractionHOF<void, [CouchDocument]> =>
	(db: PouchDB.Database) =>
	(note: CouchDocument) =>
		fn(db)(note as I);

/**
 * Accepts a HOF returning `getNotes`, and wraps it into correct type signature.
 * This helper is not that necessary per se, but it follows the same pattern
 * as `createCommitNote` and provides typing abstraction.
 */
export const createGetNotes = (
	fn: DBInteractionHOF<CouchDocument[]>
): DBInteractionHOF<CouchDocument[]> => fn;

/**
 * Accepts a HOF returning `getStock`, and wraps it into correct type signature.
 * This helper is not that necessary per se, but it follows the same pattern
 * as `createCommitNote` and provides typing abstraction.
 */
export const createGetStock = (
	fn: DBInteractionHOF<CouchDocument>
): DBInteractionHOF<CouchDocument> => fn;

/**
 * Accepts a HOF returning `getWarehouses`, and wraps it into correct type signature.
 * This helper is not that necessary per se, but it follows the same pattern
 * as `createCommitNote` and provides typing abstraction.
 */
export const createGetWarehouses = (
	fn: DBInteractionHOF<CouchDocument[]>
): DBInteractionHOF<CouchDocument[]> => fn;

/**
 * A convenience method used for easier creation of test setup.
 *
 * Instead of passing the `createDBInterface` to the config like so:
 * ```typescript
 * export default {
 *      // ...the rest of the config
 *      createDBInterface: (db) => ({
 *          commitNote: commitNote(db), // Where the right hand side 'createNote' is a HOF declared previously
 *          getNotes: getNotes(db) // Where the right hand side 'getNotes' is a HOF declared previously
 *          // ...rest of the db interactions
 *      })
 * }
 * ```
 * we can write the interface like this:
 * ```typescript
 * export default {
 *      // ...the rest of the config
 *      createDBInterface: createDBInteractions({
 *          commitNote, // Where the 'createNote' is a HOF declared previously
 *          getNotes // Where the 'getNotes' is a HOF declared previously
 *          // ...rest of the db interactions
 *      })
 * }
 * ```
 */
export const createDBInteractions =
	(interactions: {
		commitNote: DBInteractionHOF<void, [CouchDocument]>;
		getNotes: DBInteractionHOF<CouchDocument[]>;
		getStock: DBInteractionHOF<CouchDocument>;
		getWarehouses: DBInteractionHOF<CouchDocument[]>;
	}): CreateDBInterface =>
	(db) =>
		Object.entries(interactions).reduce(
			(acc, [interactionName, createInteraction]) => ({
				...acc,
				[interactionName]: createInteraction(db)
			}),
			{} as DBInterface
		);
