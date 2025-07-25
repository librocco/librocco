import { expect } from "@playwright/test";
import { testInventory } from "@/helpers/fixtures";
import { baseURL } from "@/constants";
import { getDashboard, getDbHandle } from "@/helpers";
import {
  createOutboundNote,
  addVolumesToNote,
  upsertWarehouse,
  createInboundNote,
  commitNote
} from "@/helpers/cr-sqlite";

testInventory("should handle force withdrawal for books not in stock", async ({ page, books, warehouses }) => {
  await page.goto(baseURL);

  const dashboard = getDashboard(page);
  await dashboard.waitFor();

  const dbHandle = await getDbHandle(page);

  // Create an outbound note
  await dbHandle.evaluate(createOutboundNote, { id: 111, displayName: "Force Withdrawal Test" });

  // Navigate to outbound page and edit the note
  await page.getByRole("link", { name: "Sale" }).click();
  await dashboard.content().entityList("outbound-list").waitFor();
  await dashboard.content().entityList("outbound-list").item(0).edit();
  await dashboard.view("outbound-note").waitFor();

  // Add a book that doesn't exist in any warehouse
  const nonExistentIsbn = "9999999999";
  const isbnInput = page.getByPlaceholder("Scan to add books");
  await isbnInput.fill(nonExistentIsbn);
  await page.keyboard.press("Enter");

  // Verify the book was added with no warehouse
  const table = dashboard.content().table("outbound-note");
  await table.assertRows([
    {
      isbn: nonExistentIsbn,
      warehouseName: ""
    }
  ]);

  // Open the warehouse selector dropdown
  await table.row(0).field("warehouseName").click();

  // Verify "No stock available..." message is shown
  const dropdown = page.getByTestId("dropdown-menu");
  await expect(dropdown.getByText("No stock available...")).toBeVisible();

  // Click the "Force withdrawal" button
  await dropdown.getByText("Force withdrawal").click();

  // Verify the force withdrawal dialog appears
  const forceWithdrawalDialog = page.getByRole("dialog");
  await expect(forceWithdrawalDialog).toBeVisible();
  await expect(forceWithdrawalDialog).toContainText(`Force withdrawal for ${nonExistentIsbn}?`);
  await expect(forceWithdrawalDialog).toContainText("This book is out of stock.");

  // Verify all warehouses are available for selection
  const warehouseSelect = forceWithdrawalDialog.locator("#warehouse-force-withdrawal");
  for (const warehouse of warehouses) {
    await expect(warehouseSelect.locator(`option[value="${warehouse.id}"]`)).toBeVisible();
    await expect(warehouseSelect.locator(`option[value="${warehouse.id}"]`)).not.toHaveClass(/hidden/);
  }

  // Select a warehouse
  await warehouseSelect.selectOption({ label: warehouses[0].displayName });

  // Verify the notification about the effect
  await expect(forceWithdrawalDialog).toContainText(`A stock adjustment will be recorded for 1 copy of ${nonExistentIsbn} in ${warehouses[0].displayName}.`);

  // Confirm the force withdrawal
  await forceWithdrawalDialog.getByRole("button", { name: "Confirm" }).click();

  // Verify the warehouse is now selected and marked as "Forced"
  await expect(table.row(0).field("warehouseName")).toContainText(warehouses[0].displayName);
  await expect(table.row(0).field("warehouseName")).toContainText("Forced");

  // Open the warehouse selector again
  await table.row(0).field("warehouseName").click();

  // Verify the dropdown still shows "No stock available..."
  await expect(dropdown.getByText("No stock available...")).toBeVisible();

  // Click the "Force withdrawal" button again
  await dropdown.getByText("Force withdrawal").click();

  // Verify the force withdrawal dialog appears with the previously selected warehouse
  await expect(forceWithdrawalDialog).toBeVisible();
  const selectedOption = await warehouseSelect.evaluate((select) => {
    return (select as HTMLSelectElement).value;
  });
  expect(selectedOption).toBe(warehouses[0].id.toString());

  // Try to confirm without changing the selection
  const confirmButton = forceWithdrawalDialog.getByRole("button", { name: "Confirm" });
  await expect(confirmButton).toBeDisabled();

  // Select a different warehouse
  await warehouseSelect.selectOption({ label: warehouses[1].displayName });
  await expect(confirmButton).toBeEnabled();

  // Confirm the new selection
  await confirmButton.click();

  // Verify the warehouse has been updated
  await expect(table.row(0).field("warehouseName")).toContainText(warehouses[1].displayName);
  await expect(table.row(0).field("warehouseName")).toContainText("Forced");
});

testInventory("should handle warehouse selection for books in stock", async ({ page, books, warehouses }) => {
  await page.goto(baseURL);

  const dashboard = getDashboard(page);
  await dashboard.waitFor();

  const dbHandle = await getDbHandle(page);

  // Create an outbound note
  await dbHandle.evaluate(createOutboundNote, { id: 111, displayName: "Warehouse Selection Test" });

  // Setup stock for a book in two different warehouses with different quantities
  const INBOUND_NOTE_ID_1 = 222;
  const INBOUND_NOTE_ID_2 = 333;
  
  // Add 3 copies to Warehouse 1
  await dbHandle.evaluate(createInboundNote, { id: INBOUND_NOTE_ID_1, warehouseId: warehouses[0].id });
  await dbHandle.evaluate(addVolumesToNote, [INBOUND_NOTE_ID_1, { isbn: books[0].isbn, quantity: 3 }] as const);
  await dbHandle.evaluate(commitNote, INBOUND_NOTE_ID_1);

  // Add 5 copies to Warehouse 2
  await dbHandle.evaluate(createInboundNote, { id: INBOUND_NOTE_ID_2, warehouseId: warehouses[1].id });
  await dbHandle.evaluate(addVolumesToNote, [INBOUND_NOTE_ID_2, { isbn: books[0].isbn, quantity: 5 }] as const);
  await dbHandle.evaluate(commitNote, INBOUND_NOTE_ID_2);

  // Navigate to outbound page and edit the note
  await page.getByRole("link", { name: "Sale" }).click();
  await dashboard.content().entityList("outbound-list").waitFor();
  await dashboard.content().entityList("outbound-list").item(0).edit();
  await dashboard.view("outbound-note").waitFor();

  // Add the book to the note
  const isbnInput = page.getByPlaceholder("Scan to add books");
  await isbnInput.fill(books[0].isbn);
  await page.keyboard.press("Enter");

  // Verify the book was added
  const table = dashboard.content().table("outbound-note");
  await table.assertRows([
    {
      isbn: books[0].isbn,
      warehouseName: ""
    }
  ]);

  // Open the warehouse selector dropdown
  await table.row(0).field("warehouseName").click();

  // Verify both warehouses are shown with their available quantities
  const dropdown = page.getByTestId("dropdown-menu");
  await expect(dropdown.locator(`div:has-text("${warehouses[0].displayName}")`)).toBeVisible();
  await expect(dropdown.locator(`div:has-text("${warehouses[1].displayName}")`)).toBeVisible();
  
  // Verify the stock quantities are displayed
  await expect(dropdown.locator(`div:has-text("${warehouses[0].displayName}")`)).toContainText("3 copies available");
  await expect(dropdown.locator(`div:has-text("${warehouses[1].displayName}")`)).toContainText("5 copies available");

  // Select the first warehouse
  await dropdown.locator(`div:has-text("${warehouses[0].displayName}")`).click();

  // Verify the warehouse is now selected
  await expect(table.row(0).field("warehouseName")).toContainText(warehouses[0].displayName);
  await expect(table.row(0).field("warehouseName")).not.toContainText("Forced");

  // Open the warehouse selector again
  await table.row(0).field("warehouseName").click();

  // Click the "Force withdrawal" button
  await dropdown.getByText("Force withdrawal").click();

  // Verify the force withdrawal dialog appears
  const forceWithdrawalDialog = page.getByRole("dialog");
  await expect(forceWithdrawalDialog).toBeVisible();

  // Verify warehouses with stock are hidden from selection
  const warehouseSelect = forceWithdrawalDialog.locator("#warehouse-force-withdrawal");
  await expect(warehouseSelect.locator(`option[value="${warehouses[0].id}"]`)).toHaveClass(/hidden/);
  await expect(warehouseSelect.locator(`option[value="${warehouses[1].id}"]`)).toHaveClass(/hidden/);

  // Verify there are no selectable options (since all warehouses have stock)
  const options = await warehouseSelect.locator('option:not(.hidden):not([disabled])').count();
  expect(options).toBe(0);

  // Cancel the dialog
  await forceWithdrawalDialog.getByRole("button", { name: "Cancel" }).click();

  // Add a third warehouse with no stock
  await dbHandle.evaluate(upsertWarehouse, { id: warehouses.length + 1, displayName: "Empty Warehouse" });

  // Open the warehouse selector again
  await table.row(0).field("warehouseName").click();

  // Click the "Force withdrawal" button
  await dropdown.getByText("Force withdrawal").click();

  // Verify the force withdrawal dialog appears
  await expect(forceWithdrawalDialog).toBeVisible();

  // Verify warehouses with stock are hidden, but the empty warehouse is available
  await expect(warehouseSelect.locator(`option[value="${warehouses[0].id}"]`)).toHaveClass(/hidden/);
  await expect(warehouseSelect.locator(`option[value="${warehouses[1].id}"]`)).toHaveClass(/hidden/);
  await expect(warehouseSelect.locator('option:has-text("Empty Warehouse")')).not.toHaveClass(/hidden/);

  // Select the empty warehouse
  await warehouseSelect.selectOption({ label: "Empty Warehouse" });

  // Confirm the force withdrawal
  await forceWithdrawalDialog.getByRole("button", { name: "Confirm" }).click();

  // Verify the warehouse is now selected and marked as "Forced"
  await expect(table.row(0).field("warehouseName")).toContainText("Empty Warehouse");
  await expect(table.row(0).field("warehouseName")).toContainText("Forced");
});

testInventory("should filter out warehouses with no remaining stock in dropdown", async ({ page, books, warehouses }) => {
  await page.goto(baseURL);

  const dashboard = getDashboard(page);
  await dashboard.waitFor();

  const dbHandle = await getDbHandle(page);

  // Create an outbound note
  await dbHandle.evaluate(createOutboundNote, { id: 111, displayName: "Stock Filtering Test" });

  // Setup stock for a book in two different warehouses
  const INBOUND_NOTE_ID_1 = 222;
  const INBOUND_NOTE_ID_2 = 333;
  
  // Add 1 copy to Warehouse 1
  await dbHandle.evaluate(createInboundNote, { id: INBOUND_NOTE_ID_1, warehouseId: warehouses[0].id });
  await dbHandle.evaluate(addVolumesToNote, [INBOUND_NOTE_ID_1, { isbn: books[0].isbn, quantity: 1 }] as const);
  await dbHandle.evaluate(commitNote, INBOUND_NOTE_ID_1);

  // Add 2 copies to Warehouse 2
  await dbHandle.evaluate(createInboundNote, { id: INBOUND_NOTE_ID_2, warehouseId: warehouses[1].id });
  await dbHandle.evaluate(addVolumesToNote, [INBOUND_NOTE_ID_2, { isbn: books[0].isbn, quantity: 2 }] as const);
  await dbHandle.evaluate(commitNote, INBOUND_NOTE_ID_2);

  // Navigate to outbound page and edit the note
  await page.getByRole("link", { name: "Sale" }).click();
  await dashboard.content().entityList("outbound-list").waitFor();
  await dashboard.content().entityList("outbound-list").item(0).edit();
  await dashboard.view("outbound-note").waitFor();

  // Add the book to the note and assign to Warehouse 1
  await dbHandle.evaluate(addVolumesToNote, [111, { isbn: books[0].isbn, quantity: 1, warehouseId: warehouses[0].id }] as const);

  // Verify the book was added with Warehouse 1
  const table = dashboard.content().table("outbound-note");
  await table.assertRows([
    {
      isbn: books[0].isbn,
      warehouseName: warehouses[0].displayName
    }
  ]);

  // Add the book again
  const isbnInput = page.getByPlaceholder("Scan to add books");
  await isbnInput.fill(books[0].isbn);
  await page.keyboard.press("Enter");

  // Verify a new row was added with no warehouse
  await table.assertRows([
    {
      isbn: books[0].isbn,
      warehouseName: ""
    },
    {
      isbn: books[0].isbn,
      warehouseName: warehouses[0].displayName
    }
  ]);

  // Open the warehouse selector dropdown for the new row
  await table.row(0).field("warehouseName").click();

  // Verify only Warehouse 2 is shown (since Warehouse 1's stock is fully allocated)
  const dropdown = page.getByTestId("dropdown-menu");
  await expect(dropdown.locator(`div:has-text("${warehouses[0].displayName}")`)).not.toBeVisible();
  await expect(dropdown.locator(`div:has-text("${warehouses[1].displayName}")`)).toBeVisible();
  await expect(dropdown.locator(`div:has-text("${warehouses[1].displayName}")`)).toContainText("2 copies available");

  // Select Warehouse 2
  await dropdown.locator(`div:has-text("${warehouses[1].displayName}")`).click();

  // Add the book a third time
  await isbnInput.fill(books[0].isbn);
  await page.keyboard.press("Enter");

  // Verify a new row was added with no warehouse
  await table.assertRows([
    {
      isbn: books[0].isbn,
      warehouseName: ""
    },
    {
      isbn: books[0].isbn,
      warehouseName: warehouses[1].displayName
    },
    {
      isbn: books[0].isbn,
      warehouseName: warehouses[0].displayName
    }
  ]);

  // Open the warehouse selector dropdown for the new row
  await table.row(0).field("warehouseName").click();

  // Verify Warehouse 2 is still shown with 1 copy available (since we've allocated 1 of 2)
  await expect(dropdown.locator(`div:has-text("${warehouses[1].displayName}")`)).toBeVisible();
  await expect(dropdown.locator(`div:has-text("${warehouses[1].displayName}")`)).toContainText("1 copy available");

  // Select Warehouse 2 again
  await dropdown.locator(`div:has-text("${warehouses[1].displayName}")`).click();

  // Add the book a fourth time
  await isbnInput.fill(books[0].isbn);
  await page.keyboard.press("Enter");

  // Verify a new row was added with no warehouse
  await table.assertRows([
    {
      isbn: books[0].isbn,
      warehouseName: ""
    },
    {
      isbn: books[0].isbn,
      warehouseName: warehouses[1].displayName
    },
    {
      isbn: books[0].isbn,
      warehouseName: warehouses[1].displayName
    },
    {
      isbn: books[0].isbn,
      warehouseName: warehouses[0].displayName
    }
  ]);

  // Open the warehouse selector dropdown for the new row
  await table.row(0).field("warehouseName").click();

  // Verify no warehouses are shown in the dropdown (all stock is allocated)
  await expect(dropdown.getByText("No stock available...")).toBeVisible();

  // Click the "Force withdrawal" button
  await dropdown.getByText("Force withdrawal").click();

  // Verify the force withdrawal dialog appears
  const forceWithdrawalDialog = page.getByRole("dialog");
  await expect(forceWithdrawalDialog).toBeVisible();

  // Verify all warehouses are available for force withdrawal (since we're forcing)
  const warehouseSelect = forceWithdrawalDialog.locator("#warehouse-force-withdrawal");
  await expect(warehouseSelect.locator(`option[value="${warehouses[0].id}"]`)).not.toHaveClass(/hidden/);
  await expect(warehouseSelect.locator(`option[value="${warehouses[1].id}"]`)).not.toHaveClass(/hidden/);

  // Select Warehouse 1 for force withdrawal
  await warehouseSelect.selectOption({ label: warehouses[0].displayName });

  // Confirm the force withdrawal
  await forceWithdrawalDialog.getByRole("button", { name: "Confirm" }).click();

  // Verify the warehouse is now selected and marked as "Forced"
  await expect(table.row(0).field("warehouseName")).toContainText(warehouses[0].displayName);
  await expect(table.row(0).field("warehouseName")).toContainText("Forced");
});
