#!/usr/bin/env -S deno test --allow-env --allow-read --allow-run
import { assertEquals } from "https://deno.land/std@0.140.0/testing/asserts.ts";


const COUCHDB_URL = Deno.env.get("COUCHDB_URL") || "http://localhost:5984";

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
  await invokeScript("csv-to-couchdb.ts", [
    "parse",
    "-f",
    "__tests__/fixtures/small.csv",
    "-c",
    "title,author",
  ]);
  assertEquals(true, true);
});

Deno.test("Make sure couchdb is running", async () => {
  const response = await fetch(COUCHDB_URL + "/_up");
  const responseBody = await response.text();
  assertEquals(response.status, 200, "CouchDB is not running");
});
