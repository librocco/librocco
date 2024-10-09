import { SQLite3 } from '@sqlite.org/sqlite-wasm'

let dbCache: { [key: string]: SQLite3.Database } = {}

export async function getDB(dbname: string): Promise<SQLite3.Database> {
  if (dbCache[dbname]) {
    return dbCache[dbname]
  }

  const sqlite3 = await SQLite3.load()
  const db = new sqlite3.oo1.DB({ filename: `opfs:${dbname}`, flags: 'c' })
  dbCache[dbname] = db
  return db
}
