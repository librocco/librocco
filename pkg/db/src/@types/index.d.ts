/**
 * We're using this to create a global type declarations
 * for PouchDB global variables and such
 */
declare global {
	/**
	 * Emit funciton exists in CouchDB's outer scope when the
	 * map function is ran, and when we write it, it gets serialized to
	 * string, so we're declaring this to keep TS quiet.
	 */
	function emit(k: string | number | Array<string | number>, v?: any): void;
}

export {};
