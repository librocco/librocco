import axios from "axios";
import ChildProcess from "child_process";

const COUCHDB_URL = process.env.COUCHDB_URL || "http://localhost:5984";

/**
 *
 * @param scriptPath The path of the script to execute
 * @param scriptArgs Parameters to pass to the script
 */
function invokeScript(scriptPath: string, scriptArgs: string[]) {
  const child = ChildProcess.spawnSync(scriptPath, scriptArgs, {
    timeout: 10000,
    shell: true,
  });
  if (child.status !== 0) {
    throw new Error(
      `Error executing ${scriptPath}.\nOutput: ${child.output}\nError: ${child.error}`
    );
  }
}

test("Import small CSV file", () => {
  invokeScript("./csv-to-couchdb.ts", [
    "parse",
    "-f",
    "__tests__/fixtures/small.csv",
    "-c",
    "title,author",
  ]);
  expect(true).toBe(true);
});

beforeAll(async () => {
  let res;
  try {
    res = await axios.get(COUCHDB_URL + "/_up");
  } catch (err) {
    throw new Error(
      "CouchDB is not running. Start a docker container with the following command: docker run --rm -p 5984:5984 -d couchdb"
    );
  }
  if (res.data.status !== "ok") {
    throw new Error(
      'Is CouchDB running? We were able to reach it, but it did not respond with "ok".'
    );
  }
});
