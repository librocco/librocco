/** 
 * @TODO handle all error cases 
 * 1 - database already exists
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

// insert bulk docs
/**
 * @TODO handle all cases
 *
 * 201 Created – Document(s) have been created or updated
 * 400 Bad Request – The request provided invalid JSON data
 * 404 Not Found – Requested database not found
 */

/** @TODO type docs array according to input docs columns */
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
