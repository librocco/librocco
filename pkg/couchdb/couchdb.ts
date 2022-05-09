// connect to database
const res = await fetch("http://127.0.0.1:5984/");
const textData = await res.text();
console.log(textData);

// create a database

/** 
 * @TODO handle all error cases 
 * 1 - database already exists
 * 

    201 Created – Document(s) have been created or updated

    400 Bad Request – The request provided invalid JSON data

    404 Not Found – Requested database not found


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
// const docs =
// {
//     "docs": [
//         {
//             "_id": "FishStew"
//         },
//         {
//             "_id": "LambStew",
//             "_rev": "2-0786321986194c92dd3b57dfbfc741ce",
//             "_deleted": true
//         }
//     ]
// }
/** @TODO type docs array according to input docs columns */
export const bulkDocs = async (
    docs: {
        [key: string]: string;
    }[],
    dbName: string,
    couchdbURL: string
) => {
    const insertDocs = await fetch(
        `${couchdbURL}/${dbName}/_bulk_docs`,
        {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(docs),
        }
    );
    const insertDocsRes = await insertDocs.text();
    console.log({ insertDocsRes });
};
