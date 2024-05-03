import { currentVersion } from "./currentVersion";

import type { NewDatabase, NewOrdersDatabase } from "./types";

import * as inventoryImplementations from "./implementations/inventory";
import * as ordersImplementations from "./implementations/orders";

import { createVersioningFunction } from "./utils/misc";

const newInventoryDatabaseInterface = inventoryImplementations[currentVersion] as NewDatabase;
const newOrdersDatabaseInterface = ordersImplementations[currentVersion] as NewOrdersDatabase;
export { newInventoryDatabaseInterface, newOrdersDatabaseInterface };

/** A function used to version the document id with the current version (if the doc id is already versioned, noop) */
export const versionId = createVersioningFunction(currentVersion);

export * from "./enums";
export * from "./types";
export * from "./constants";
export * from "./errors";
export { isBookRow, isCustomItemRow } from "./utils/misc";
