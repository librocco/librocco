import sqlite3InitModule from "@sqlite.org/sqlite-wasm";

let dbCache: { [key: string]: SQLite3.oo1.DB } = {};

export async function getDB(dbname: string): Promise<SQLite3.oo1.DB> {
  if (dbCache[dbname]) {
    return dbCache[dbname];
  }

  const sqlite3 = await sqlite3InitModule();
  const db = new sqlite3.oo1.DB(`opfs:${dbname}`, 'c');
  dbCache[dbname] = db;
  return db;
}
