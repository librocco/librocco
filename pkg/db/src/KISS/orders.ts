import sqlite3InitModule from "@sqlite.org/sqlite-wasm";

let dbCache: { [key: string]: SQLite3.Database } = {};

export async function getDB(dbname: string): Promise<any> {}
