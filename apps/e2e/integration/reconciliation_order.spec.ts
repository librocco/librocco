import { expect } from "@playwright/test";

import { baseURL } from "./constants";
import { testOrders } from "@/helpers/fixtures";
import { createSupplierOrder } from "@/helpers/cr-sqlite";
import { getDbHandle } from "@/helpers";

// * Note: its helpful to make an assertion after each <enter> key
// as it seems that Playwright may start running assertions before page data has fully caught up
testOrders("should show correct initial state of reconciliation page", async ({ page, placedOrderLines }) => {
	await page.goto(`${baseURL}orders/suppliers/orders/`);
	await page.getByText("Ordered").nth(1).click();
	await page.getByRole("checkbox").nth(1).click();
	await page.getByText("Reconcile").first().click();

	// Verify initial UI elements
	await expect(page.getByText("Reconcile Deliveries")).toBeVisible();
	await expect(page.getByPlaceholder("Enter ISBN of delivered books")).toBeVisible();
	await expect(page.getByText(placedOrderLines[0].isbn)).not.toBeVisible();
});
testOrders("should show correct comparison when quantities match ordered amounts", async ({ page, placedOrderLines }) => {
	await page.goto(`${baseURL}orders/suppliers/orders/`);
	await page.getByText("Ordered").nth(1).click();
	await page.getByRole("checkbox").nth(1).click();
	await page.getByText("Reconcile").first().click();

	const isbnInput = page.getByPlaceholder("Enter ISBN of delivered books");
	await isbnInput.fill(placedOrderLines[0].isbn);
	await page.keyboard.press("Enter");

	await page.getByRole("button", { name: "Compare" }).click();

	// Verify comparison view
	const table = page.getByRole("table");
	const supplierNameRow = table.getByRole("row").nth(1);
	supplierNameRow.getByRole("cell", { name: placedOrderLines[0].supplier_name });

	const firstRow = table.getByRole("row").nth(2);
	firstRow.getByRole("cell", { name: placedOrderLines[0].isbn });
	await expect(firstRow.getByRole("checkbox")).toBeChecked();

	await expect(page.getByText("Total delivered:")).toBeVisible();
	await expect(page.getByText("1 / 1")).toBeVisible(); // Assuming 1 was ordered
});

testOrders("should correctly increment quantities when scanning same ISBN multiple times", async ({ page, books, placedOrderLines }) => {
	await page.goto(`${baseURL}orders/suppliers/orders/`);
	await page.getByText("Ordered").nth(1).click();
	await page.getByRole("checkbox").nth(1).click();
	await page.getByText("Reconcile").first().click();
	await expect(page.getByText("Reconcile Deliveries")).toBeVisible();

	const table = page.getByRole("table");
	const firstRow = table.getByRole("row").nth(1);
	firstRow.getByRole("cell", { name: placedOrderLines[0].isbn });

	const isbnInput = page.getByPlaceholder("Enter ISBN of delivered books");

	await isbnInput.fill("1111111111");
	await page.keyboard.press("Enter");

	// Wait for the first row to be added
	await expect(table.getByText("1111111111")).toBeVisible();

	await isbnInput.fill("1111111111");
	await page.keyboard.press("Enter");

	const secondRow = table.getByRole("row").nth(2);

	await expect(firstRow.getByRole("cell", { name: "2" })).toBeVisible();

	await isbnInput.fill(books[0].isbn);
	await page.keyboard.press("Enter");

	// Check new isbn row is visible
	await expect(table.getByText(books[0].isbn)).toBeVisible();

	await isbnInput.fill("1111111111");
	await page.keyboard.press("Enter");

	// Check the 111111 row quantity is updated
	await expect(firstRow.getByRole("cell", { name: "1111111111" })).toBeVisible();
	await expect(firstRow.getByRole("cell", { name: "3" })).toBeVisible();
	await expect(secondRow.getByRole("cell", { name: books[0].isbn })).toBeVisible();

	await expect(secondRow.getByRole("cell", { name: "1", exact: true })).toBeVisible();
});
testOrders("should show over-delivery when scanned quantities are more than ordered amounts", async ({ page, placedOrderLines }) => {
	await page.goto(`${baseURL}orders/suppliers/orders/`);
	await page.getByText("Ordered").nth(1).click();
	await page.getByRole("checkbox").nth(1).click();
	await page.getByText("Reconcile").first().click();

	const isbnInput = page.getByPlaceholder("Enter ISBN of delivered books");

	// Scan more than ordered
	await isbnInput.fill(placedOrderLines[0].isbn);
	await page.keyboard.press("Enter");

	const table = page.getByRole("table");
	const firstRow = table.getByRole("row").nth(1);
	await expect(firstRow.getByRole("cell", { name: placedOrderLines[0].isbn }).first()).toBeVisible();

	await isbnInput.fill(placedOrderLines[0].isbn);
	await page.keyboard.press("Enter");

	await expect(firstRow.getByRole("cell", { name: placedOrderLines[0].isbn }).first()).toBeVisible();

	await page.getByRole("button", { name: "Compare" }).nth(1).click();

	const supplierNameRow = table.getByRole("row").nth(1);
	supplierNameRow.getByRole("cell", { name: placedOrderLines[0].supplier_name });

	// Verify comparison shows over-delivery
	await expect(page.getByText("2 / 1")).toBeVisible();
});
testOrders(
	"should show under-delivery when ordered books are not scanned or the scanned quantities are less than ordered amounts",
	async ({ page, placedOrderLines, books }) => {
		// Navigate to reconciliation
		const dbHandle = await getDbHandle(page);
		await dbHandle.evaluate(createSupplierOrder, [{ ...books[2], supplier_id: 1, supplier_name: "sup1", quantity: 1, line_price: 10 }]);
		await page.goto(`${baseURL}orders/suppliers/orders/`);

		await page.getByText("Ordered").nth(1).click();
		await page.getByRole("checkbox").nth(1).click();
		await page.getByRole("checkbox").nth(2).click();

		await page.getByText("Reconcile").first().click();

		const isbnInput = page.getByPlaceholder("Enter ISBN of delivered books");

		// Scan less quantity than ordered
		// From fixtures we know placedOrderLines[0] has quantity: 1
		await isbnInput.fill(placedOrderLines[0].isbn);
		await page.keyboard.press("Enter");

		// Move to comparison view
		await page.getByRole("button", { name: "Compare" }).click();

		// Verify comparison table structure
		const table = page.getByRole("table");

		// Check supplier name row
		const supplierNameRow = table.getByRole("row").nth(1);
		await expect(supplierNameRow.getByRole("cell", { name: placedOrderLines[0].supplier_name })).toBeVisible();

		// Check book details row
		const bookRow = table.getByRole("row").nth(2);
		await expect(bookRow.getByRole("cell", { name: placedOrderLines[0].isbn })).toBeVisible();

		// Verify delivery stats show under-delivery
		await expect(page.getByText("Total delivered:")).toBeVisible();
		await expect(page.getByText("1 / 2")).toBeVisible(); // Assuming 2 were ordered, 1 scanned

		// Optional: Verify any visual indicators of under-delivery
		// This depends on your UI implementation
		// await expect(bookRow.getByRole("cell").nth(4)).toHaveClass("text-warning"); // Example
	}
);
testOrders("should show unmatched deliveriesy when ordered books do not match scanned books", async ({ page, placedOrderLines, books }) => {
	// Navigate to reconciliation
	await page.goto(`${baseURL}orders/suppliers/orders/`);

	await page.getByText("Ordered").nth(1).click();
	await page.getByRole("checkbox").nth(1).click();

	await page.getByText("Reconcile").first().click();

	const isbnInput = page.getByPlaceholder("Enter ISBN of delivered books");

	// Scan non ordered books
	await isbnInput.fill(placedOrderLines[0].isbn);
	await page.keyboard.press("Enter");

	const table = page.getByRole("table");
	await expect(table.getByText(placedOrderLines[0].isbn)).toBeVisible();

	await isbnInput.fill(books[2].isbn);
	await page.keyboard.press("Enter");

	await expect(table.getByText(books[2].isbn)).toBeVisible();

	// Move to comparison view
	await page.getByRole("button", { name: "Compare" }).nth(1).click();

	// Verify comparison table structure

	// Check supplier name row
	const unmatchedRow = table.getByRole("row").nth(1);
	await expect(unmatchedRow.getByRole("cell", { name: "unmatched" })).toBeVisible();

	// Check book details row
	const unmatchedBookRow = table.getByRole("row").nth(2);
	await expect(unmatchedBookRow.getByRole("cell", { name: books[2].isbn })).toBeVisible();

	const supplierNameRow = table.getByRole("row").nth(3);
	await expect(supplierNameRow.getByRole("cell", { name: placedOrderLines[0].supplier_name })).toBeVisible();

	const matchedBookRow = table.getByRole("row").nth(4);
	await expect(matchedBookRow.getByRole("cell", { name: placedOrderLines[0].isbn })).toBeVisible();

	await expect(page.getByText("Total delivered:")).toBeVisible();
	await expect(page.getByText("2 / 1")).toBeVisible();
});
testOrders("should show correct delivery stats in commit view", async ({ page, books, placedOrderLines }) => {
	await page.goto(`${baseURL}orders/suppliers/orders/`);
	await page.getByText("Ordered").nth(1).click();
	await page.getByRole("checkbox").nth(1).click();
	await page.getByText("Reconcile").first().click();
	await expect(page.getByText("Reconcile Deliveries")).toBeVisible();

	const isbnInput = page.getByPlaceholder("Enter ISBN of delivered books");
	const table = page.getByRole("table");
	const firstRow = table.getByRole("row").nth(1);
	firstRow.getByRole("cell", { name: placedOrderLines[0].isbn });

	await isbnInput.fill("1111111111");
	await page.keyboard.press("Enter");

	// Wait for the first row to be added
	await expect(table.getByText("1111111111").first()).toBeVisible();

	await isbnInput.fill("1111111111");
	await page.keyboard.press("Enter");

	// Check the quantity is updated before...
	// TODO: more specific selectors for table cells?
	await expect(table.getByText("2").first()).toBeVisible();

	// ... moving to compare
	await page.getByRole("button", { name: "Compare" }).first().click();

	await expect(page.getByText("Total delivered:")).toBeVisible();

	await expect(table.getByText(books[0].isbn)).toBeVisible();

	await expect(table.getByText("1111111111")).toBeVisible();

	await page.waitForTimeout(1000);

	await expect(page.getByText("2 / 1")).toBeVisible();
});
