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
 * Thrown when the DB fails to open due to a transient issue (e.g. OPFS file handle lock
 * from a previous page load that hasn't been released yet). A simple page reload typically
 * resolves this — no data loss, no nuke required.
 */
export class ErrDBOpenTransient extends Error {
	constructor(message: string) {
		super(message);
		this.name = "ErrDBOpenTransient";
	}
}

/**
 * Thrown when DB initialization exceeds the allowed time budget. This usually means
 * the worker is deadlocked or the Comlink channel is broken. A page reload often fixes it;
 * if not, resetting the database is the nuclear option.
 */
export class ErrDBInitTimeout extends Error {
	constructor() {
		super(
			"Database initialization timed out. The database may be locked by a previous session — try reloading the page. If the problem persists, reset the database."
		);
		this.name = "ErrDBInitTimeout";
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
