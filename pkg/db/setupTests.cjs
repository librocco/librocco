// As tests are run in browser environment, the browser version of PouchDB is used, 
// which depends on the global object.
globalThis.global = globalThis;
