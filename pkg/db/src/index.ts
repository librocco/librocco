const currentVersion = 'v1';

import * as implementations from './implementations';
const newDatabaseInterface = implementations[currentVersion];
export { newDatabaseInterface };

export * from './enums';
export * from './types';
