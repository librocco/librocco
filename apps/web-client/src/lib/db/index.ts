import pouchdb from 'pouchdb';

import { newDatabaseInterface } from '@librocco/db';

// @TODO: This should probably be an env variable
const pouch = new pouchdb('dev');
export const db = newDatabaseInterface(pouch);
