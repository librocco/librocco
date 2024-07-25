import { currentVersion } from "./currentVersion";

import type { InventoryDatabaseConstructor, OrdersDatabaseConstructor } from "./types";

import * as inventoryImplementations from "./implementations/inventory";
import * as ordersImplementations from "./implementations/orders";

import { createVersioningFunction } from "./utils/misc";

const newInventoryDatabaseInterface = inventoryImplementations[currentVersion] as InventoryDatabaseConstructor;
const newOrdersDatabaseInterface = ordersImplementations[currentVersion] as OrdersDatabaseConstructor;
export { newInventoryDatabaseInterface, newOrdersDatabaseInterface };

/** A function used to version the document id with the current version (if the doc id is already versioned, noop) */
export const versionId = createVersioningFunction(currentVersion);

export * from "./enums";
export * from "./types";
export * from "./constants";
export * from "./errors";

export { isBookRow, isCustomItemRow } from "./utils/misc";
export { fetchBookDataFromSingleSource } from "./utils/plugins";
