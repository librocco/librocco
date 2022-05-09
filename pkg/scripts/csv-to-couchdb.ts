#!/usr/bin/env -S deno run --allow-read --allow-net

import { CouchClient } from "https://denopkg.com/keroxp/deno-couchdb/couch.ts";
import Denomander from "https://deno.land/x/denomander@0.9.1/mod.ts";
import { CommonCSVReaderOptions, readCSV } from "https://deno.land/x/csv/mod.ts";
import ProgressBar from "https://deno.land/x/progress@v1.2.4/mod.ts";
import { BufReader } from "https://deno.land/std/io/buffer.ts";
import { bulkDocs, createDatabase } from "../couchdb/couchdb.ts"

const howManyLines = async function (fileName: string) {
    let lineCount: number = 0;
    var file;
    console.log({ fileName })
    try {
        file = await Deno.open(fileName);
        const bufReader = new BufReader(file);
        while (await bufReader.readLine()) {
            lineCount++
        };
    } finally {
        if (file) file.close();
    }
    return lineCount;
}

//#region progress bar
let completed = 0;
function downloading(progress: ProgressBar) {
    if (completed <= progress.total!) {
        progress.render(completed++);
    }
}
//#endregion progress bar


//#region csv to couch


async function CSVToCouch({ filePath, columns, couchdbName = "books",
    couchdbURL = "http://admin:admin@localhost:5984", columnSeparator = ",", progress }: {
        filePath: string,
        columns: string, couchdbName: string,
        couchdbURL: string, columnSeparator: string,
        progress: ProgressBar

    }) {

    // create couch client with endpoint
    const columnsArr = columns.split(',')



    // csv file options
    const options = { columnSeparator: columnSeparator }

    // await parseCSVToDocs(filePath, columnsArr, couchdbURL, couchdbName, progress, options)
    await parseCSVToArray(filePath, columnsArr, couchdbURL, couchdbName, progress, options)


}

//#endregion csv to couch



//#region program
const program = new Denomander({
    app_name: "CSV to CouchDB",
});


program.command("parse", "parses csv file into the db")
    .requiredOption("-f --filePath", "csv file path")
    .requiredOption("-c --columns", "names of headers of each column")
    .option("-n --name", "couch database name")
    .option("-s --separator", "column separator of csv file")
    .option("-u -couchdbURL", "url of couchdb, defaults to local couchdb")
    .action(async () => {
        const title = 'parsing csv files:';
        const progress = new ProgressBar({
            title,
            total: await howManyLines(program.filePath)
        });


        await CSVToCouch({
            filePath: program.filePath, columns: program.columns,
            couchdbName: program.name, couchdbURL: program.couchdbURL,
            columnSeparator: program.separator, progress: progress
        })
    })
    .parse(Deno.args)



//#endregion program


//#region bulk parse fn
const parseCSVToArray = async (filePath: string, columnsArr: string[], couchdbURL: string, couchdbName: string, progress: ProgressBar, options?: Partial<CommonCSVReaderOptions> | undefined) => {
    try {
        await createDatabase(couchdbName, couchdbURL)
        const f = await Deno.open(filePath);

        let books = [];
        // null?
        for await (const row of readCSV(f, options)) {
            let book: { [key: string]: string } = {};
            let i = 0;
            for await (const cell of row) {

                const fieldName = columnsArr[i];
                book[fieldName] = cell;
                i++;
            }
            downloading(progress);

            // write into a file .json
            await Deno.writeTextFile("./jsonBulkDocs.txt", "Hello World!");
            books.push((book))
        }

        f.close();
        await bulkDocs(books, couchdbName, couchdbURL)


    }
    catch (error) {
        console.error(error)
    }
}
//#endregion bulk parse fn

//#region individual doc parse fn
const parseCSVToDocs = async (filePath: string, columnsArr: string[], couchdbURL: string, couchdbName: string, progress: ProgressBar, options?: Partial<CommonCSVReaderOptions> | undefined) => {

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
            downloading(progress);

        }

        f.close();

    }
    catch (error) {
        console.error(error)
    }
}
//#endregion individual doc parse fn
