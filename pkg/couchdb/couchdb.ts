/** 
 * This file uses the `fetch` API: only import it with deno or node >= v18
 * @TODO handle all error cases
 * 1. database already exists
*/

/**
 * Creates a couchdb database
 * @param {string} dbName - couchdb database name
 * @param {string} couchdbURL - URL of remote database
 */
export const createDatabase = async (couchdbServerURL: string, dbName: string) => {
        const database = await fetch(
            `${couchdbServerURL}/${dbName}`,
            { method: "PUT" }
        );
    const databaseRes = await database.text();
}


/**
 * Deletes a couchdb database
 * @param {string} couchdbURL - URL of remote database
 * @param {string} dbName - couchdb database name
 */
 export const removeDatabase = async (couchdbURL: string, dbName: string) => {
    const database = await fetch(
        `${couchdbURL}/${dbName}`,
        { method: "DELETE" }
    );
    const databaseRes = await database.text();
}

/**
 * @TODO handle all cases:
 * 201 Created – Document(s) have been created or updated
 * 400 Bad Request – The request provided invalid JSON data
 * 404 Not Found – Requested database not found
 */

/**
 * Inserts batch of docs into a couchdb database
 * Only import with deno and node >= v18
 * @param {sting[]} docs - array of docs to be inserted in db
 * @param {string} dbName - name of database
 * @param {string} couchdbURL - URL of remote database
 */

export const postBulkDocs = async (
    docs: {
        [key: string]: string;
    }[],
    dbName: string,
    couchdbURL: string
) => {
    await fetch(
        `${couchdbURL}/${dbName}/_bulk_docs`,
        {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ docs: docs }),
        }
    );
};


/**
 * 
 * @param couchdbURL The base URL of the Couchdb server 
 * @param dbName The name of the Couchdb database
 * @returns The json decoded response from the server
 */
export const getAllDocs = async (couchdbURL: string, dbName: string) => {
    const response = await fetch(
        `${couchdbURL}/${dbName}/_all_docs?include_docs=true`,
        {
            method: "GET",
            headers: { "content-type": "application/json" },
        }
    );
    const responseBody = await response.json();
    return responseBody;
}
