import { currentVersion } from "./currentVersion";

import type { InventoryDatabaseConstructor, OrdersDatabaseConstructor } from "./types";

import * as inventoryImplementations from "./implementations/inventory";
import * as ordersImplementations from "./implementations/orders";

export * from "./enums";
export * from "./types";
export * from "./constants";
export * from "./errors";

export { isBookRow, isCustomItemRow } from "./utils/misc";
export { fetchBookDataFromSingleSource } from "./utils/plugins";

import * as KISSDB from "./KISS/db";
import * as KISSORDERS from "./KISS/orders";
const KISS = {
	db: KISSDB,
	orders: KISSORDERS
};

const newInventoryDatabaseInterface = inventoryImplementations[currentVersion] as InventoryDatabaseConstructor;
const newOrdersDatabaseInterface = ordersImplementations[currentVersion] as OrdersDatabaseConstructor;
export { newInventoryDatabaseInterface, newOrdersDatabaseInterface, KISS };
