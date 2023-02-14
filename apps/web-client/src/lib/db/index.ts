import pouchdb from 'pouchdb';

import { newDatabaseInterface } from '@librocco/db';

// @TODO: This should probably be an env variable
const pouch = new pouchdb('http://admin:admin@127.0.0.1:5000/dev');
export const db = newDatabaseInterface(pouch);
