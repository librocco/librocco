/**
 * Thrown when trying to retrieve the DB (e.g. `await getDb(app)`) before any DB was registered.
 */
export class ErrDbNotSet extends Error {
	constructor() {
		super("No DB is registered with the app. Use 'initializeDB' to set up the app DB");
		this.name = "EddDbNotSet";
	}
}

/**
 * Thrown when trying to use a DB before state = Ready. This is thrown only in
 * (app) DB handlers that require the ready state. To await DB initialisation,
 * use `await getDb(app)` - as it returns a promise that resolves when the DB is ready.
 */
export class ErrDbNotInit extends Error {
	constructor() {
		super("The DB is not initialised yet.");
		this.name = "ErrDbNotInit";
	}
}

/**
 * A soft error (normally returned rather than thrown) used to signal that the currently active DBID had
 * changed while a differe tDB was being initialised:
 * - this is used for control flow when initialising a DB
 * - this case is generally noop (regarding the no-longer-active dbid initialisation) and shouldn't affect the
 *   initialisation/usage of (apps) current DB
 */
export class ErrDBIDMismatch extends Error {
	constructor(want: string, got: string) {
		super(
			[
				`DBID mismatch: want: ${want}, got: ${got}`,
				"  this is probably due to active DB being updated before the old one was initialised"
			].join("\n")
		);
		this.name = "ErrDBIDMismatch";
	}
}

/**
 * Thrown when DB integrity check fails (during initialisation).
 * The DB should be nuke-and-resynced
 */
export class ErrDBCorrupted extends Error {
	constructor(message: string) {
		super(message);
		this.name = "ErrDBCorrupted";
	}
}

/**
 * Thrown when trying to retrieve the app sync interface (e.g. `await getAppSync(app)`) before the sync was registered to the app
 */
export class ErrInvalidSyncURL extends Error {
	constructor(url: string) {
		super(`Invalid sync URL: "${url}"`);
		this.name = "ErrInvalidSyncURL";
	}
}
