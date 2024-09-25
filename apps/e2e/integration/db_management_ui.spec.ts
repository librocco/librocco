import { test } from "@playwright/test";

import { baseURL } from "./constants";

import { getDashboard } from "@/helpers";
import { selector, testIdSelector } from "@/helpers/utils";
import { DashboardNode } from "@/helpers/types";

test.beforeEach(async ({ page }) => {
	// Load the app
	await page.goto(baseURL);

	const dashboard = getDashboard(page);
	await dashboard.waitFor();

	// Navigate to the settings page
	await dashboard.navigate("settings");
});

test("selecting a db should be reflected in app data", async ({ page }) => {
	const dashboard = getDashboard(page);
	const warehouseList = dashboard.content().entityList("warehouse-list");
	const dialog = dashboard.dialog();

	await page.evaluate(() => window.navigator.storage.getDirectory().then((dir) => dir.getFileHandle("db_1.sqlite3", { create: true })));
	await page.evaluate(() => window.navigator.storage.getDirectory().then((dir) => dir.getFileHandle("db_2.sqlite3", { create: true })));

	await page.reload();

	const container = page.locator(selector(testIdSelector("database-management-container")));
	const list = container.locator(selector(testIdSelector("database-management-list")));

	// The dbs should appear in the list
	await list.getByText("db_1.sqlite3").waitFor();
	await list.getByText("db_2.sqlite3").waitFor();

	// Testing for db selection: create something distinct in both dbs and observe the behaviour
	//
	// Select the first db and create a warehouse
	await getDBSelection(dashboard).select("db_1.sqlite3");
	await dashboard.navigate("inventory");
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
	await dashboard.navigate("settings");

	await getDBSelection(dashboard).select("db_2.sqlite3");
	await dashboard.navigate("inventory");
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
	await dashboard.navigate("settings");

	await getDBSelection(dashboard).select("db_1.sqlite3");
	await dashboard.navigate("inventory");
	await warehouseList.assertElements([{ name: "Warehouse 1 - db 1" }]);
});

export function getDBSelection(parent: DashboardNode) {
	const dashboard = parent.dashboard;

	const container = parent.locator(selector(testIdSelector("database-management-container")));
	const list = parent.locator(selector(testIdSelector("database-management-list")));

	const select = async (name: string) => {
		await container.getByRole("button", { name: "Select" }).click();
		await list.getByText(name).click();
		await list.locator(`[data-active=true]`).getByText(name).waitFor();
	};

	return Object.assign(container, { dashboard, select });
}
