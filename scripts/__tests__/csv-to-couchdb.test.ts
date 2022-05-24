#!/usr/bin/env -S deno test --allow-env --allow-read --allow-run --allow-net
import { assertEquals, assertStringIncludes } from "https://deno.land/std@0.140.0/testing/asserts.ts";
import { removeDatabase, getAllDocs } from "../../pkg/couchdb/couchdb.ts";
import { v4 as uuid4 } from "https://deno.land/std@0.139.0/uuid/mod.ts";


const COUCHDB_URL = Deno.env.get("COUCHDB_URL") || "http://admin:admin@localhost:5984";

/**
 *
 * @param scriptPath The path of the script to execute
 * @param scriptArgs Parameters to pass to the script
 */
async function invokeScript(scriptPath: string, scriptArgs: string[]) {
  const __dirname = new URL('.', import.meta.url).pathname;
  const execution = Deno.run({
    cmd: [__dirname + '../' + scriptPath, ...scriptArgs],
    stdout: "piped",
    stderr: "piped",
  });
  const output = await execution.output()
  const outStr = new TextDecoder().decode(output);
  const error = await execution.stderrOutput()
  const errStr = new TextDecoder().decode(error);
  const status = await execution.status();
  await execution.close();
  return {
    output: outStr,
    error: errStr,
    status,
  }
}

Deno.test("Import small CSV file", async () => {
  const dbName = uuid4.generate()
  const result = await invokeScript("csv-to-couchdb.ts", [
    "parse",
    "--filePath",
    "__tests__/fixtures/small.csv",
    "--columns",
    "isbn,title,author",
    "--chunkSize",
    "2",
    "--dbName",
    dbName,
  ]);
  assertStringIncludes(result.output, "Successfully imported 5 documents");
  const response = await getAllDocs(COUCHDB_URL, dbName);
  const titles = response.rows.map((el: any) => el.doc.title)
  titles.sort();
  const expectedTitles = [
    "Don Quixote",
    "In Search of Lost Time",
    "One Hundred Years of Solitude",
    "The Great Gatsby",
    "Ulysses",
  ];
  assertEquals(titles, expectedTitles);
  await removeDatabase(COUCHDB_URL, dbName);
});

Deno.test("Make sure couchdb is running", async () => {
  const response = await fetch(COUCHDB_URL + "/_up");
  const responseBody = await response.text();
  assertEquals(JSON.parse(responseBody).status, "ok");
  assertEquals(response.status, 200, "CouchDB is not running");
})
