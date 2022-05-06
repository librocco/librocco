#!/usr/bin/env -S deno run --allow-read --allow-net

import { CouchClient } from "https://denopkg.com/keroxp/deno-couchdb/couch.ts";
import Denomander from "https://deno.land/x/denomander@0.9.1/mod.ts";
import { readCSV } from "https://deno.land/x/csv/mod.ts";



async function CSVToCouch({ filePath, columns, couchdbName = "books",
    couchdbURL = "http://admin:admin@localhost:5984", columnSeparator = "," }: {
        filePath: string,
        columns: string, couchdbName: string,
        couchdbURL: string, columnSeparator: string
    }) {

    // create couch client with endpoint
    const columnsArr = columns.split(',')

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

    // csv file options
    const options = { columnSeparator: columnSeparator }

    try {


        const f = await Deno.open(filePath);

        for await (const row of readCSV(f, options)) {
            let book: { [key: string]: string } = {};
            let i = 0;
            for await (const cell of row) {

                const fieldName = columnsArr[i];
                book[fieldName] = cell;
                i++;
            }
            await db.insert(book)
        }

        f.close();

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
    .option("-s --separator", "column separator of csv file")
    .option("-u -couchdbURL", "url of couchdb, defaults to local couchdb")
    .action(async () => await CSVToCouch({
        filePath: program.filePath, columns: program.columns,
        couchdbName: program.name, couchdbURL: program.couchdbURL, columnSeparator: program.separator
    }))
    .parse(Deno.args)

