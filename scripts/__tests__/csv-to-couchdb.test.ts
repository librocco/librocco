import axios from "axios";

const COUCHDB_URL = process.env.COUCHDB_URL || "http://localhost:5984";

test("dummy", () => {
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
