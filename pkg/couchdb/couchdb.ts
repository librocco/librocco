/** 
 * @TODO handle all error cases 
 * 1. database already exists
*/

/**
 * Creates a couchdb database
 * Only import with deno and node >= v18
 * @param {string} dbName - couchdb database name
 * @param {string} couchdbURL - URL of remote database
 */
export const createDatabase = async (dbName: string,
    couchdbURL: string) => {
        const database = await fetch(
            `${couchdbURL}/${dbName}`,
            { method: "PUT" }
        );

    const databaseRes = await database.text();
    console.log(databaseRes);
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
