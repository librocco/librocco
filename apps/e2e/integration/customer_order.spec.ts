import { test, expect } from "@playwright/test";

import { baseURL } from "./constants";
import { getDashboard, getDbHandle } from "@/helpers";
import { addBooksToCustomer, upsertCustomer } from "@/helpers/cr-sqlite";

test.beforeEach(async ({ page }) => {
	await page.goto(baseURL);

	const dashboard = getDashboard(page);

	await dashboard.waitFor();
	const dbHandle = await getDbHandle(page);
	await dbHandle.evaluate(upsertCustomer, { id: 1, fullname: "fadwa" });
	await dbHandle.evaluate(upsertCustomer, { id: 2, fullname: "also fadwa" });

	await dbHandle.evaluate(addBooksToCustomer, { customerId: 1, bookIsbns: ["1234"] });
	await dbHandle.evaluate(addBooksToCustomer, { customerId: 1, bookIsbns: ["1234", "4321"] });

	await dashboard.navigate("orders/customers");
});

test("should show list of In Progress orders", async ({ page }) => {
	expect(page.getByText("In Progress")).toBeVisible();
});
