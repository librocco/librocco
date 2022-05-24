#!/usr/bin/env -S deno run --allow-read --allow-net

import Denomander from "https://deno.land/x/denomander@0.9.1/mod.ts";
import { readCSV } from "https://deno.land/x/csv/mod.ts";
import ProgressBar from "https://deno.land/x/progress@v1.2.4/mod.ts";
import { createDatabase, postBulkDocs } from "../pkg/couchdb/couchdb.ts";
import { inChunks, rowToObjectMaker, howManyLines } from "./utils.ts";


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
 * @return {Iterator} - An iterator over the chunks
 */

async function CSVToCouch(
  {
    filePath,
    columnsString,
    couchdbName = "books",
    couchdbURL = "http://admin:admin@localhost:5984",
    columnSeparator = ",",
    chunkSize = 1000,
  }: {
    filePath: string;
    columnsString: string;
    couchdbName: string;
    couchdbURL: string;
    columnSeparator: string;
    chunkSize: number;
  },
) {
  const totalLines = await howManyLines(filePath);
  const progress = new ProgressBar({
    title: `Importing CSV file ${filePath}`,
    total: totalLines,
  });

  // create couch client with endpoint
  const columns = columnsString.split(",");

  // csv file options
  const options = { columnSeparator: columnSeparator };

  try {
    await createDatabase(couchdbURL, couchdbName);
    const f = await Deno.open(filePath);

    /** @TODO handle file reading errors or create timeout per chunk */
    let completed = 0;
    for await (
      const chunk of inChunks(readCSV(f, options), chunkSize)
    ) {
      const books = await Promise.all(chunk.map(rowToObjectMaker(columns)));
      await postBulkDocs(books, couchdbName, couchdbURL);
      if (completed <= progress.total!) {
        completed += books.length;
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
    await CSVToCouch({
      filePath: program.filePath,
      columnsString: program.columns,
      couchdbName: program.dbName,
      couchdbURL: program.couchdbURL,
      columnSeparator: program.separator,
      chunkSize: program.chunkSize,
    });
  })
  .parse(Deno.args);

//#endregion program
