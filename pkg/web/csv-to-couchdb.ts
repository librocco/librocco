#!/usr/bin/env -S deno run --allow-read --allow-net

import { CouchClient } from "https://denopkg.com/keroxp/deno-couchdb/couch.ts";
import Denomander from "https://deno.land/x/denomander@0.9.1/mod.ts";
import { parse as parseCsv } from "https://raw.githubusercontent.com/librocco/deno_std/main/encoding/csv.ts"


async function CSVToCouch(filePath: string, columns: string, couchdbName = "books", skipFirstRow = true, couchdbURL = "http://admin:admin@localhost:5984", separator = ",",) {

    // create couch client with endpoint
    const columnsArr = columns.split(',')
    console.log(columnsArr.length)
    const couch = new CouchClient(couchdbURL);
    // choose db to use
    const db = couch.database(couchdbName)
    // check if specified database exists
    if (!(await couch.databaseExists(couchdbName))) {
        // create new database
        await couch.createDatabase(couchdbName);
        console.log(`Created database ${couchdbName}`)
    } else {
        console.log(`Database ${couchdbName} already present`)
    }

    try {
        const fileContent = await Deno.readTextFile(filePath)

        const content = await parseCsv(fileContent, { skipFirstRow: skipFirstRow, separator: separator, columns: columnsArr })

        // make sure db error is handled
        /** @TODO change type unknown for book (infer from columns array somehow) */
        content.forEach(async (book: unknown) => {
            console.log({ book })
            await db.insert(book)
        })

    }
    catch (error) {
        console.error(error)
    }

}

const program = new Denomander({
    app_name: "CSV to CouchDB",
});

program.command("parse", "parses csv file into the db")
    .requiredOption("-f --filePath", "csv file path")
    .requiredOption("-c --columns", "names of headers of each column")
    .option("-n --name", "couch database name")
    .option("-k --skip", "whether or not to skip first row")
    .option("-s --separator", "separator of csv file")
    .option("-u -couchdbURL", "url of couchdb, defaults to local couchdb")
    .action(async () => await CSVToCouch(program.filePath, program.columns, program.name, program.skip, program.couchdbURL, program.separator)).parse(Deno.args)

