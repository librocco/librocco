#!/usr/bin/env node

// Run this script to test the compiled cr-sqlite

// This script is written as a CommonJS module.
// Node.js treats .js files as CommonJS by default. This allows the script
// to be run directly with `node <filename>.js` without any special configuration.
const fs = require('fs');
const path = require('path');

// __dirname is a global available in CommonJS modules, so no special handling is needed.

async function run() {
  console.log('Initializing SQLite module...');

  // The cr-sqlite and wa-sqlite libraries are distributed as ES Modules (ESM).
  // To load them from this CommonJS script, we use dynamic import(), which
  // is supported in both module systems.
  const { default: SQLiteESMFactory } = await import('./wa-sqlite/dist/crsqlite.mjs');
  const SQLite = await import('./wa-sqlite/src/sqlite-api.js');

  // IMPORTANT: The wasm binary must be loaded manually for Node.js.
  // The default behavior of SQLiteESMFactory is to use `fetch()` to load the
  // wasm file. In a Node.js environment, `fetch()` cannot access local file
  // paths. By reading the file with `fs` and passing the `wasmBinary` option,
  // we bypass the problematic `fetch()` call.
  const wasmPath = path.join(__dirname, 'wa-sqlite', 'dist', 'crsqlite.wasm');
  const wasmBinary = fs.readFileSync(wasmPath);

  // Initialize the Emscripten module with the wasm binary.
  const module = await SQLiteESMFactory({ wasmBinary });

  // Create the low-level wa-sqlite API object.
  const sqlite3 = SQLite.Factory(module);
  console.log('SQLite module initialized.');

  console.log('Opening in-memory database...');
  const db = await sqlite3.open_v2(':memory:');
  console.log('Database opened.');

  try {
    const tableName = 'foo';
    console.log(`Creating table "${tableName}"...`);
    await sqlite3.exec(db, `CREATE TABLE ${tableName} (a, b, c);`);
    console.log(`Table "${tableName}" created.`);

    console.log(`Applying cr-sqlite extension to "${tableName}"...`);
    await sqlite3.exec(db, `SELECT crsql_as_crr('${tableName}');`);
    console.log('cr-sqlite extension applied.');

    console.log(`Inserting a row into "${tableName}"...`);
    await sqlite3.exec(db, `INSERT INTO ${tableName} (a, b, c) VALUES (1, 'two', 3.3);`);
    console.log('Row inserted.');

    console.log('Querying the row back...');
    const rows = [];
    await sqlite3.exec(db, `SELECT * FROM ${tableName};`, (row, columns) => {
      // wa-sqlite exec callback provides row data as an array of values.
      // We convert it to an object for easier assertion.
      const rowObj = {};
      columns.forEach((name, i) => rowObj[name] = row[i]);
      rows.push(rowObj);
    });
    console.log('Query result:', rows);

    if (rows.length !== 1 || rows[0].a !== 1 || rows[0].b !== 'two' || rows[0].c !== 3.3) {
      throw new Error('Data verification failed!');
    }

    console.log('Test passed!');
  } finally {
    console.log('Closing database...');
    await sqlite3.close(db);
    console.log('Database closed.');
  }
}

run().catch(e => {
  console.error('Test failed:', e);
  process.exit(1);
});
