import pouchdb from 'pouchdb';

import { newDatabaseInterface, designDocuments } from '@librocco/db';

// @TODO: This should probably be an env variable
const pouch = new pouchdb('http://admin:admin@127.0.0.1:5000/dev');
export const db = newDatabaseInterface(pouch);

/**
 * A helper method used to initialise the db. This should be ran once on app start.
 */
export const initDB = () => Promise.all(designDocuments.map((doc) => db.updateDesignDoc(doc)));
