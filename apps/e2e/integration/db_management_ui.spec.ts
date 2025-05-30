import { expect } from "@playwright/test";

import { appHash } from "@/constants";

import { testBase as test } from "@/helpers/fixtures";
import { getDashboard } from "@/helpers";
import { selector, testIdSelector } from "@/helpers/utils";
import { DashboardNode } from "@/helpers/types";

test.beforeEach(async ({ page }) => {
	await page.goto(appHash("settings"));
});

// TODO: Unskip these when we manage to fix issues with COOP/COEP
test.skip("selecting a db should be reflected in app data", async ({ page }) => {
	const dashboard = getDashboard(page);
	const warehouseList = dashboard.content().entityList("warehouse-list");

	const dbSelectionBox = getDBSelection(dashboard);
	const dialog = dashboard.dialog();

	await page.evaluate(() => window.navigator.storage.getDirectory().then((dir) => dir.getFileHandle("db_1.sqlite3", { create: true })));
	await page.evaluate(() => window.navigator.storage.getDirectory().then((dir) => dir.getFileHandle("db_2.sqlite3", { create: true })));

	await page.reload();

	// The dbs should appear in the list
	await dbSelectionBox.getByFilename("db_1.sqlite3").waitFor();
	await dbSelectionBox.getByFilename("db_2.sqlite3").waitFor();

	// Testing for db selection: create something distinct in both dbs and observe the behaviour
	//
	// Select the first db and create a warehouse
	await getDBSelection(dashboard).select("db_1.sqlite3");
	await page.getByRole("link", { name: "Manage inventory" }).click();
	await dashboard.content().header().getByRole("button", { name: "New warehouse" }).click();
	await dashboard.view("warehouse").waitFor();
	await dashboard.content().header().breadcrumbs().getByText("Warehouses").click();
	await dashboard.view("inventory").waitFor();
	await warehouseList.assertElements([{ name: "New Warehouse" }]);
	await warehouseList.item(0).dropdown().edit();
	await dialog.waitFor();
	await dialog.getByRole("textbox", { name: "name" }).fill("Warehouse 1 - db 1");
	await dialog.getByRole("button", { name: "Save" }).click();
	await dialog.waitFor({ state: "detached" });

	// Select the second db and create a warehouse
	await page.getByRole("link", { name: "Settings" }).click();

	await getDBSelection(dashboard).select("db_2.sqlite3");
	await page.getByRole("link", { name: "Manage inventory" }).click();
	await dashboard.content().header().getByRole("button", { name: "New warehouse" }).click();
	await dashboard.view("warehouse").waitFor();
	await dashboard.content().header().breadcrumbs().getByText("Warehouses").click();
	await dashboard.view("inventory").waitFor();
	await warehouseList.assertElements([{ name: "New Warehouse" }]);
	await warehouseList.item(0).dropdown().edit();
	await dialog.waitFor();
	await dialog.getByRole("textbox", { name: "name" }).fill("Warehouse 1 - db 2");
	await dialog.getByRole("button", { name: "Save" }).click();
	await dialog.waitFor({ state: "detached" });

	// Switch back to the first db and check if the warehouse is still there
	await page.getByRole("link", { name: "Settings" }).click();

	await getDBSelection(dashboard).select("db_1.sqlite3");
	await page.getByRole("link", { name: "Manage inventory" }).click();

	await warehouseList.assertElements([{ name: "Warehouse 1 - db 1" }]);
});

// TODO: Unskip these when we manage to fix issues with COOP/COEP
test.skip("creating the db should make it appear in the list and select as active db", async ({ page }) => {
	const dashboard = getDashboard(page);

	const dbSelectionBox = getDBSelection(dashboard);
	const dialog = dashboard.dialog();

	// Only the default db should be present
	await dbSelectionBox.list().locator("li").nth(0).waitFor();
	await dbSelectionBox.list().locator("li").nth(1).waitFor({ state: "detached" });

	// Create a new db
	await dbSelectionBox.new();
	await dialog.waitFor();

	// Should not allow whitespace
	await dialog.getByRole("textbox", { name: "name" }).fill("new db");
	await dialog.getByRole("button", { name: "Save" }).click();

	// Type in a valid name
	await dialog.getByRole("textbox", { name: "name" }).fill("new_db");
	await dialog.getByRole("button", { name: "Save" }).click();
	await dialog.waitFor({ state: "detached" });

	await dbSelectionBox.getByFilename("new_db.sqlite3").waitFor();
	await expect(dbSelectionBox.getByFilename("new_db.sqlite3")).toHaveAttribute("data-active", "true");
	// Check that there are only two dbs: default and new
	await dbSelectionBox.list().locator("li").nth(2).waitFor({ state: "detached" });
});

// TODO: Unskip these when we manage to fix issues with COOP/COEP
test.skip("deleting a db should remove it from the list", async ({ page }) => {
	const dashboard = getDashboard(page);

	const dbSelectionBox = getDBSelection(dashboard);
	const dialog = dashboard.dialog();

	await page.evaluate(() => window.navigator.storage.getDirectory().then((dir) => dir.getFileHandle("db_1.sqlite3", { create: true })));
	await page.evaluate(() => window.navigator.storage.getDirectory().then((dir) => dir.getFileHandle("db_2.sqlite3", { create: true })));
	await page.evaluate(() => window.navigator.storage.getDirectory().then((dir) => dir.getFileHandle("db_3.sqlite3", { create: true })));

	await page.reload();

	// The dbs should appear in the list
	await dbSelectionBox.getByFilename("db_1.sqlite3").waitFor();
	await dbSelectionBox.getByFilename("db_2.sqlite3").waitFor();

	// Delete the db
	await dbSelectionBox.delete("db_1.sqlite3");
	await dialog.waitFor();

	// The dialog should display the db name (without .sqlite3 ext) to type in as confirmation
	await dialog.getByPlaceholder("db_1").waitFor();
	await dialog.confirm();

	// The dialog should not have been closed (nor db deleted) without name input as confirmation
	await dbSelectionBox.getByFilename("db_1.sqlite3").waitFor();

	// Type in the wrong text (the dialog should not close nor warehouse be deleted)
	await dialog.getByPlaceholder("db_1").fill("db_2");
	await dialog.confirm();
	await dbSelectionBox.getByFilename("db_1.sqlite3").waitFor();
	await dbSelectionBox.getByFilename("db_2.sqlite3").waitFor();

	// Type in the correct confirmation name and complete the deletion
	await dialog.getByPlaceholder("db_1").fill("db_1");
	await dialog.confirm();

	await dialog.waitFor({ state: "detached" });
	await dbSelectionBox.getByFilename("db_1.sqlite3").waitFor({ state: "detached" });
	await dbSelectionBox.getByFilename("db_2.sqlite3").waitFor();

	// Deleting a currently active db should fall back to the first available in the list
	//
	// Select db_2
	await dbSelectionBox.select("db_2.sqlite3");

	// Delete the db
	await dbSelectionBox.delete("db_2.sqlite3");
	await dialog.waitFor();
	await dialog.getByPlaceholder("db_2").fill("db_2");
	await dialog.confirm();

	await dialog.waitFor({ state: "detached" });
	await dbSelectionBox.getByFilename("db_2.sqlite3").waitFor({ state: "detached" });

	// We're left with two dbs: dev.slite3 and db_3.sqlite3
	// Whichever is first in the list should also be active
	await expect(dbSelectionBox.list().locator("li").nth(0)).toHaveAttribute("data-active", "true");
});

export function getDBSelection(parent: DashboardNode) {
	const dashboard = parent.dashboard;

	const container = parent.locator(selector(testIdSelector("database-management-container")));
	const list = () => parent.locator(selector(testIdSelector("database-management-list")));

	const select = async (name: string) => {
		await container.getByRole("button", { name: "Select" }).click();
		await list().getByText(name).click();
		await list().locator(`[data-active=true]`).getByText(name).waitFor();
	};

	const getByFilename = (name: string) => list().locator(`[data-file="${name}"]`);

	const _delete = async (name: string) => {
		await getByFilename(name).hover();
		return getByFilename(name)
			.locator(selector(testIdSelector("db-action-delete")))
			.click();
	};

	const _new = () => container.getByRole("button", { name: "New" }).click();

	return Object.assign(container, { dashboard, select, getByFilename, delete: _delete, list, new: _new });
}
