import { currentVersion } from "./currentVersion";

import type { NewDatabase } from "./types";

import * as implementations from "./implementations";

import { createVersioningFunction } from "./utils/misc";

const newDatabaseInterface = implementations[currentVersion] as NewDatabase;
export { newDatabaseInterface };

/** A function used to version the document id with the current version (if the doc id is already versioned, noop) */
export const versionId = createVersioningFunction(currentVersion);

export * from "./enums";
export * from "./types";
export * from "./constants";
export * from "./errors";
