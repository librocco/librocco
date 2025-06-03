import { test, expect } from "@playwright/test";
import { entityListView, testId, stripNulls } from "@librocco/shared";

// E2E specific path helper - replace with actual if available, or define a simple one
const Navigation = {
  path: (base: string, ...args: string[]) => `/${base}/${args.join('/')}`
};

import { db } from "apps/e2e/helpers/db";
import {
  PastNoteBuilder,
  WarehouseBuilder,
  CustomerBuilder,
  CustomerOrderLineBuilder,
  BookBuilder,
  SupplierBuilder,
  SupplierOrderBuilder,
  SupplierOrderLineBuilder,
  NoteBuilder, // For open notes
  NoteEntryBuilder, // For note entries
  NoteCustomItemBuilder // For custom items in notes
} from "@librocco/shared/testUtils";
import { Content } from "apps/e2e/helpers";

const getIsoDateString = (date: Date) => date.toISOString().slice(0, 10);

test.describe("Printable Views", () => {
  test.beforeEach(async ({ page }) => {
    await db.reset();
  });

  test("should display printable past notes view correctly", async ({ page, context }) => {
    const warehouse = new WarehouseBuilder().withName("Main Warehouse").build();
    await db.insert("warehouse", stripNulls(warehouse));
    const noteDate = new Date();
    const noteDateStr = getIsoDateString(noteDate);
    const pastNote1 = new PastNoteBuilder()
      .withWarehouseId(warehouse.id)
      .withWarehouseName(warehouse.name)
      .withDisplayName("DN001")
      .withCommittedAt(noteDate.toISOString())
      .withTotalBooks(10)
      .withTotalCoverPrice(100)
      .withTotalDiscountedPrice(80)
      .build();
    await db.insert("note", stripNulls({ ...pastNote1, committed: noteDate.toISOString() }));
    const originalNotesPath = Navigation.path("history/notes/date", noteDateStr);
    await page.goto(originalNotesPath);
    await Content.waitForViewToLoad("history/notes");
    const pagePromise = context.waitForEvent('page');
    const printButtonSelector = `a[href*="/print"][target="_blank"]`;
    await page.locator(printButtonSelector).first().click();
    const newPage = await pagePromise;
    await newPage.waitForLoadState();
    await expect(newPage).toHaveURL(/**.*\/print/);
    await newPage.locator('h1:text("Printable Past Notes")').waitFor({state: "visible"});
    await expect(newPage.locator('header h1')).toContainText('Printable Past Notes');
    await expect(newPage.locator('header .print-date')).toContainText('Printed on:');
    const table = newPage.locator("table");
    await expect(table).toBeVisible();
    await expect(table.locator("th").nth(0)).toHaveText("Warehouse");
    await expect(table.locator("th").nth(1)).toHaveText("Display Name");
    await expect(table.locator("th").nth(2)).toHaveText("Total Books");
    const firstRow = table.locator("tbody tr").first();
    await expect(firstRow.locator("td").nth(0)).toContainText(pastNote1.warehouseName);
    await expect(firstRow.locator("td").nth(1)).toContainText(pastNote1.displayName);
    await expect(firstRow.locator("td").nth(2)).toContainText(String(pastNote1.totalBooks));
    await expect(firstRow.locator("td").nth(3)).toContainText(pastNote1.totalCoverPrice.toFixed(2));
    await expect(newPage.locator('.print-date-footer')).toBeVisible();
    await newPage.close();
  });

  test("should display printable customer order view correctly", async ({ page, context }) => {
    const customer = new CustomerBuilder().withFullname("John Doe").withDisplayId("JD001").build();
    await db.insert("customer", stripNulls(customer));
    const book = new BookBuilder().withIsbn("978-1234567890").withTitle("Test Book").withAuthors("Author A").withPrice(25.00).withPublisher("Test Publisher").build();
    await db.insert("book", stripNulls(book));
    const orderLine = new CustomerOrderLineBuilder()
        .withCustomerId(customer.id)
        .withBookId(book.id)
        .withIsbn(book.isbn)
        .withTitle(book.title)
        .withAuthors(book.authors)
        .withPrice(book.price)
        .withPublisher(book.publisher)
        .withStatus("Pending")
        .build();
    await db.insert("customer_order_lines", stripNulls(orderLine));
    const originalCustomerOrderPath = Navigation.path("orders/customers", String(customer.id));
    await page.goto(originalCustomerOrderPath);
    await Content.waitForViewToLoad("orders/customers/id");
    const pagePromise = context.waitForEvent('page');
    const printButton = page.locator(`a.btn:has-text("Print receipt")[href*="/print"][target="_blank"]`);
    await printButton.click();
    const newPage = await pagePromise;
    await newPage.waitForLoadState();
    await expect(newPage).toHaveURL(/**.*\/print/);
    await newPage.locator('h1:text("Printable Customer Order")').waitFor({state: "visible"});
    await expect(newPage.locator('header h1')).toContainText('Printable Customer Order');
    await expect(newPage.locator('header .print-subtitle')).toContainText(`Order for: ${customer.fullname} (#${customer.displayId})`);
    await expect(newPage.locator('section.customer-details')).toContainText(`Name: ${customer.fullname} (#${customer.displayId})`);
    await expect(newPage.locator('section.customer-details')).toContainText(`Total Amount: €${book.price.toFixed(2)}`);
    const table = newPage.locator("section.order-lines table");
    await expect(table).toBeVisible();
    await expect(table.locator("th").nth(0)).toHaveText("ISBN");
    await expect(table.locator("th").nth(1)).toHaveText("Title");
    const firstRow = table.locator("tbody tr").first();
    await expect(firstRow.locator("td").nth(0)).toContainText(book.isbn);
    await expect(firstRow.locator("td").nth(1)).toContainText(book.title);
    await expect(firstRow.locator("td").nth(3)).toContainText(`€${book.price.toFixed(2)}`);
    await expect(newPage.locator('.print-date-footer')).toBeVisible();
    await newPage.close();
  });

  test("should display printable supplier order view correctly", async ({ page, context }) => {
    const supplier = new SupplierBuilder().withName("Supplier Inc.").build();
    await db.insert("supplier", stripNulls(supplier));
    const book = new BookBuilder().withIsbn("978-0987654321").withTitle("Supplier Book").withPrice(30.00).build();
    await db.insert("book", stripNulls(book)); // Assume book needs to exist for order lines

    // Create a supplier order (parent)
    const supplierOrder = new SupplierOrderBuilder()
        .withSupplierId(supplier.id)
        .withReconciled(false) // or true, depending on what you want to test
        .build();
    const insertedOrder = await db.insert("supplier_order", stripNulls(supplierOrder));
    const orderId = insertedOrder.id; // Get the actual ID

    // Create a supplier order line (child)
    const orderLine = new SupplierOrderLineBuilder()
        .withSupplierOrderId(orderId)
        .withIsbn(book.isbn)
        .withTitle(book.title) // Title might be denormalized or joined
        .withQuantity(5)
        .withPrice(book.price) // Price might be from book or overridden
        .build();
    await db.insert("supplier_order_line", stripNulls(orderLine));

    const originalSupplierOrderPath = Navigation.path("orders/suppliers", String(supplier.id));
    await page.goto(originalSupplierOrderPath);
    await Content.waitForViewToLoad("orders/suppliers/id");

    const pagePromise = context.waitForEvent('page');
    // Assuming a "Print Orders List" button/link exists with similar properties
    const printButton = page.locator(`a.btn:has-text("Print Orders List")[href*="/print"][target="_blank"]`);
    await printButton.click();

    const newPage = await pagePromise;
    await newPage.waitForLoadState();

    await expect(newPage).toHaveURL(/**.*\/print/);
    await newPage.locator('h1:text("Printable Supplier Order")').waitFor({state: "visible"});

    await expect(newPage.locator('header h1')).toContainText('Printable Supplier Order');
    await expect(newPage.locator('header .print-subtitle')).toContainText(`Supplier: ${supplier.name} (#${supplier.id})`);

    await expect(newPage.locator('section.supplier-details')).toContainText(`Name: ${supplier.name} (#${supplier.id})`);

    const orderItemDiv = newPage.locator(`.order-item:has-text("Order ID: ${orderId}")`);
    await expect(orderItemDiv).toBeVisible();
    await expect(orderItemDiv.locator("h3")).toContainText(`Order ID: ${orderId}`);

    const table = orderItemDiv.locator("table");
    await expect(table).toBeVisible();
    await expect(table.locator("th").nth(0)).toHaveText("ISBN");
    await expect(table.locator("th").nth(1)).toHaveText("Title");
    await expect(table.locator("th").nth(2)).toHaveText("Quantity");

    const firstRow = table.locator("tbody tr").first();
    await expect(firstRow.locator("td").nth(0)).toContainText(book.isbn);
    await expect(firstRow.locator("td").nth(1)).toContainText(book.title);
    await expect(firstRow.locator("td").nth(2)).toContainText(String(orderLine.quantity));
    await expect(firstRow.locator("td").nth(3)).toContainText(`€${orderLine.price.toFixed(2)}`);

    await expect(newPage.locator('.print-date-footer')).toBeVisible();
    await newPage.close();
  });

  test("should display printable open outbound note view correctly", async ({ page, context }) => {
    const warehouse = new WarehouseBuilder().withName("Source Warehouse").build();
    await db.insert("warehouse", stripNulls(warehouse));

    const note = new NoteBuilder()
        .withNoteType("outbound")
        .withWarehouseId(warehouse.id) // Assuming warehouseId is relevant for outbound
        .withWarehouseName(warehouse.name)
        .withDisplayName("Outbound001")
        .withCommitted(null) // Open note
        .build();
    const insertedNote = await db.insert("note", stripNulls(note));
    const noteId = insertedNote.id;

    const bookEntry = new NoteEntryBuilder()
        .withNoteId(noteId)
        .withIsbn("978-1111222233")
        .withTitle("Outbound Book")
        .withQuantity(3)
        .withPrice(15.00)
        .build();
    await db.insert("note_entries", stripNulls(bookEntry));

    const customItem = new NoteCustomItemBuilder()
        .withNoteId(noteId)
        .withName("Special Item")
        .withQuantity(1)
        .withPrice(5.00)
        .build();
    await db.insert("note_custom_items", stripNulls(customItem));

    const originalOutboundPath = Navigation.path("outbound", String(noteId));
    await page.goto(originalOutboundPath);
    await Content.waitForViewToLoad("outbound/id");

    const pagePromise = context.waitForEvent('page');
    const printButton = page.locator(`a.btn:has-text("Print Note")[href*="/print"][target="_blank"]`);
    await printButton.click();

    const newPage = await pagePromise;
    await newPage.waitForLoadState();

    await expect(newPage).toHaveURL(/**.*\/print/);
    await newPage.locator('h1:text("Printable Open Outbound Note")').waitFor({state: "visible"});

    await expect(newPage.locator('header h1')).toContainText('Printable Open Outbound Note');
    await expect(newPage.locator('header .print-subtitle')).toContainText(`Note: ${note.displayName} (#${noteId})`);

    await expect(newPage.locator('section.note-details')).toContainText(`Name: ${note.displayName} (#${noteId})`);
    await expect(newPage.locator('section.note-details')).toContainText(`Warehouse: ${warehouse.name}`);

    // Book Entries Table
    const bookTable = newPage.locator("section.book-entries table");
    await expect(bookTable).toBeVisible();
    await expect(bookTable.locator("th").nth(0)).toHaveText("ISBN");
    await expect(bookTable.locator("th").nth(1)).toHaveText("Title");
    await expect(bookTable.locator("tbody tr").first().locator("td").nth(0)).toContainText(bookEntry.isbn);
    await expect(bookTable.locator("tbody tr").first().locator("td").nth(1)).toContainText(bookEntry.title);

    // Custom Items Table
    const customItemTable = newPage.locator("section.custom-items table");
    await expect(customItemTable).toBeVisible();
    await expect(customItemTable.locator("th").nth(0)).toHaveText("Name");
    await expect(customItemTable.locator("th").nth(1)).toHaveText("Quantity");
    await expect(customItemTable.locator("tbody tr").first().locator("td").nth(0)).toContainText(customItem.name);
    await expect(customItemTable.locator("tbody tr").first().locator("td").nth(1)).toContainText(String(customItem.quantity));

    await expect(newPage.locator('.print-date-footer')).toBeVisible();
    await newPage.close();
  });

  test("should display printable open inbound note view correctly", async ({ page, context }) => {
    const warehouse = new WarehouseBuilder().withName("Target Warehouse").build();
    await db.insert("warehouse", stripNulls(warehouse));

    const note = new NoteBuilder()
        .withNoteType("inbound")
        .withWarehouseId(warehouse.id)
        .withWarehouseName(warehouse.name)
        .withDisplayName("Inbound001")
        .withCommitted(null) // Open note
        .build();
    const insertedNote = await db.insert("note", stripNulls(note));
    const noteId = insertedNote.id;

    const bookEntry = new NoteEntryBuilder()
        .withNoteId(noteId)
        .withIsbn("978-4444555566")
        .withTitle("Inbound Book")
        .withQuantity(8)
        .withPrice(22.00)
        .build();
    await db.insert("note_entries", stripNulls(bookEntry));

    const originalInboundPath = Navigation.path("inventory/inbound", String(noteId));
    await page.goto(originalInboundPath);
    // The view name for inbound notes might be "inventory/inbound/id"
    await Content.waitForViewToLoad("inventory/inbound/id");


    const pagePromise = context.waitForEvent('page');
    // Assuming the print button has a similar structure
    const printButton = page.locator(`a.btn:has-text("Print Note")[href*="/print"][target="_blank"]`);
    await printButton.click();

    const newPage = await pagePromise;
    await newPage.waitForLoadState();

    await expect(newPage).toHaveURL(/**.*\/print/);
    await newPage.locator('h1:text("Printable Open Inbound Note")').waitFor({state: "visible"});

    await expect(newPage.locator('header h1')).toContainText('Printable Open Inbound Note');
    await expect(newPage.locator('header .print-subtitle')).toContainText(`Note: ${note.displayName} (#${noteId})`);

    await expect(newPage.locator('section.note-details')).toContainText(`Name: ${note.displayName} (#${noteId})`);
    await expect(newPage.locator('section.note-details')).toContainText(`Warehouse: ${warehouse.name}`);

    const table = newPage.locator("section.book-entries table");
    await expect(table).toBeVisible();
    await expect(table.locator("th").nth(0)).toHaveText("ISBN");
    await expect(table.locator("th").nth(1)).toHaveText("Title");
    const firstRow = table.locator("tbody tr").first();
    await expect(firstRow.locator("td").nth(0)).toContainText(bookEntry.isbn);
    await expect(firstRow.locator("td").nth(1)).toContainText(bookEntry.title);

    await expect(newPage.locator('.print-date-footer')).toBeVisible();
    await newPage.close();
  });
});
