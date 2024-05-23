import type { Page } from "@playwright/test";

import type { InventoryDatabaseInterface } from "@librocco/db";

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
	return page.evaluateHandle(async () => {
		const w = window as { [key: string]: any };

		// Wait for the db to become initialised
		await new Promise<void>((res) => {
			if (w["db_ready"]) {
				return res();
			} else {
				// Creating a separate function, as we want to run the listener only once and then remove it
				const finalise = () => {
					window.removeEventListener("db_ready", finalise), res();
				};
				window.addEventListener("db_ready", finalise);
			}
		});

		return w["_db"] as InventoryDatabaseInterface;
	});
}
