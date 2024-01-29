import type { Page } from "@playwright/test";

import type { DatabaseInterface } from "@librocco/db";

/**
 * Returns the database handle from the db interface registered in the window object
 * of the app. We can run `hadle.evaluate` to run queries/mutations against the database.
 * @example
 * ```ts
 * const dbHandle = await getDbHandle(page);
 *
 * // Use the handle to create a warehouse in the db
 * await dbHandle.evaluate(async (db) => {
 *   await db.warehouse("foo-wh").create()
 * })
 * ```
 */
export function getDbHandle(page: Page) {
	return page.evaluateHandle(() => (window as { [key: string]: any })["_db"] as DatabaseInterface);
}
