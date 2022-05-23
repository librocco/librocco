#!/usr/bin/env -S deno run --allow-read --allow-net

import Denomander from "https://deno.land/x/denomander@0.9.1/mod.ts";
import { readCSV } from "https://deno.land/x/csv/mod.ts";
import ProgressBar from "https://deno.land/x/progress@v1.2.4/mod.ts";
import { BufReader } from "https://deno.land/std/io/buffer.ts";
import { createDatabase, postBulkDocs } from "../pkg/couchdb/couchdb.ts";

/**
 * Counts lines in a csv file for progress bar calculations
 * @param {string} filePath - csv file path
 * @return {Number} - Number of lines in file
 */

const howManyLines = async function (filePath: string) {
  let lineCount: number = 0;
  var file;
  try {
    file = await Deno.open(filePath);
    const bufReader = new BufReader(file);
    while (await bufReader.readLine()) {
      lineCount++;
    }
  } finally {
    if (file) file.close();
  }
  return lineCount;
};

//#region progress bar
/**
 * Renders progress bar
 * @param {ProgressBar} progress - progress bar instance
 * @param {Number} completed - amount of accumulative progress
 */
function printProgress(progress: ProgressBar, completed: number) {
  progress.render(completed);
}

//#endregion progress bar

//#region csv to couch
/**
 * Parses CSV file and saves docs into couchdb
 * @param {string} filePath - csv file path
 * @param {string} columns - headers of doc columns
 * @param {string} couchdbName - name of couchdb database (default: books)
 * @param {string} couchdbURL - url of couchdb database (default: http://admin:admin@localhost:5984)
 * @param {string} columnSeparator - separator used for columns (default: ,)
 * @param {ProgressBar} progress - progress bar instance
 * @return {Iterator} - An iterator over the chunks
 */

async function CSVToCouch(
  {
    filePath,
    columns,
    couchdbName = "books",
    couchdbURL = "http://admin:admin@localhost:5984",
    columnSeparator = ",",
    chunkSize = 1000,
    progress,
  }: {
    filePath: string;
    columns: string;
    couchdbName: string;
    couchdbURL: string;
    columnSeparator: string;
    chunkSize: number;
    progress: ProgressBar;
  },
) {
  // create couch client with endpoint
  const columnsArr = columns.split(",");

  // csv file options
  const options = { columnSeparator: columnSeparator };

  try {
    await createDatabase(couchdbName, couchdbURL);
    const f = await Deno.open(filePath);
    console.log(`Importing ${progress.total} documents`);

    /** @TODO handle file reading errors or create timeout per chunk */
    let completed = 0;
    for await (
      const chunk of inChunks(readCSV(f, options), chunkSize, columnsArr)
    ) {
      await postBulkDocs(chunk, couchdbName, couchdbURL);
      if (completed <= progress.total!) {
        completed += chunkSize;
        printProgress(progress, completed);
      }
    }
    f.close();
  } catch (error) {
    console.error(error);
  }
  console.log(`Successfully imported ${progress.total} documents`);
}

//#endregion csv to couch

//#region program

const program = new Denomander({
  app_name: "CSV to CouchDB",
});

program.command("parse", "parses csv file into the db")
  .requiredOption("-f --filePath", "csv file path")
  .requiredOption("-c --columns", "names of headers of each column")
  .option("-n --dbName", "CouchDB database name")
  .option("-s --separator", "column separator of csv file")
  .option("-u --couchdbURL", "url of couchdb, defaults to local couchdb")
  .option("-k --chunkSize", "size of chunk the csv file will be divided into")
  .action(async () => {
    const title = "parsing csv files:";
    const progress = new ProgressBar({
      title,
      total: await howManyLines(program.filePath),
    });

    await CSVToCouch({
      filePath: program.filePath,
      columns: program.columns,
      couchdbName: program.dbName,
      couchdbURL: program.couchdbURL,
      columnSeparator: program.separator,
      chunkSize: program.chunkSize,
      progress: progress,
    });
  })
  .parse(Deno.args);

//#endregion program

//#region chunk generator

/**
 * Aggregate in chinks values from an Iterable
 * @param {Iterator} csv The iterator to take values from
 * @param {Number} chunkSize - The size of the chunks
 * @return {Iterator} - An iterator over the chunks
 */
const inChunks = async function* <T>(
  sequence: AsyncIterable<AsyncIterable<string>>,
  chunkSize: number,
  columnsArr: string[],
) {
  let chunk = [];
  for await (const element of sequence) {
    let book: { [key: string]: string } = {};
    let i = 0;
    for await (const field of element) {
      const fieldName = columnsArr[i];
      book[fieldName] = field;
      i++;
    }
    chunk.push(book);
    if (chunk.length === chunkSize) {
      yield chunk;
      chunk = [];
    }
    yield chunk;
  }
};

//#endregion chunk generator
