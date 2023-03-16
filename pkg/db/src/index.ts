import { currentVersion } from './currentVersion';

import * as implementations from './implementations';
import type { NewDatabase } from './types';

const newDatabaseInterface = implementations[currentVersion] as NewDatabase;
export { newDatabaseInterface };

export * from './enums';
export * from './types';
