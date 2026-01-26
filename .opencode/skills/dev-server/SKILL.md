---
name: dev-server
description: Navigate to Librocco dev server and verify it's running correctly
license: MIT
compatibility: opencode
---

## What I do
- Navigate to the Librocco dev server at `http://localhost:5173/preview/#/`
- Verify the page loads successfully by checking for either:
  - The "Librocco is loading" message, OR
  - The Librocco logo visible anywhere on the screen
- If the "Librocco is loading" message is present, wait until it's no longer visible (app has finished loading)
- Report any errors or unexpected page content
- Use Playwright MCP tools for browser navigation when available
- **Generate dummy data using the debug page** when working with views that expect data (suppliers, customers, books, orders, etc.) - ONLY if the view is empty (no data present)

## Dev Server Location
The dev server should be found at `http://localhost:5173/preview/#/`.

## Verification
Visiting this URL should show EITHER:
- A message containing "Librocco is loading" (the full message is typically "Librocco is loading. Hang tight!")
- OR the Librocco logo visible anywhere on the screen

If the loading message is present, wait until it disappears before considering the page fully loaded.

## Error Handling
If the page shows:
- Connection refused/timeout → The dev server is not running
- 404 errors → The dev server may be running at a different port or path
- Any other unexpected content → There may be an issue with the dev server

In any error case or if the page displays something other than the expected loading message or Librocco logo, report the issue clearly to the user and do not proceed with any further actions.

## Important Constraints
- **NEVER** start the dev server automatically
- If the dev server is not running, ask the user to start it manually using: `cd apps/web-client && rushx start`
- Only use Playwright MCP tools (or a dedicated agent if available) for browser navigation

## Debug Page and Dummy Data Generation

The dev server includes a debug page at `http://localhost:5173/preview/#/debug` that can generate test data for the application. **Only use this when a view is empty and requires data to work with.**

### When to Generate Data
- When navigating to a view and finding it empty (e.g., "No suppliers", "No customers", "No books")
- When testing features that require existing data (suppliers, publishers, orders, etc.)
- **Do not generate data if data already exists** - this avoids unnecessary work and potential data duplication

### How to Generate Data
1. Navigate to the debug page: `http://localhost:5173/preview/#/debug`
2. Click the appropriate button based on the data you need
3. Wait for the operation to complete (a console message will indicate success)
4. Navigate to the target view to work with the generated data

### Available Data Generation Options

**Populate Database** button:
- Creates comprehensive test data set with realistic relationships
- **Books**: 4 books (The Art of Learning, Lord of the Flies, The Da Vinci Code, Dune)
- **Suppliers**: 2 suppliers (BooksRUs, NovelSupply Co.)
- **Supplier Publishers**: 4 publisher assignments (Mondadori & Doubleday to BooksRUs, Scholastic & Ace to NovelSupply Co.)
- **Customers**: 2 customers (Alice Smith, Bob Johnson)
- **Customer Order Lines**: 6 order lines with various statuses (placed, received, collected)
- **Supplier Orders**: 2 supplier orders
- **Supplier Order Lines**: 2 order lines
- **Reconciliation Orders**: 2 reconciliation orders (one finalized, one pending)
- **Reconciliation Order Lines**: 2 order lines

**Upsert 100 Books** button:
- Generates larger dataset for book-related testing
- **Books**: 100 test books (Test Book 1-100 with deterministic ISBNs and prices)
- **Suppliers**: 100 suppliers (one distribution company per publisher)
- **Supplier Publishers**: 100 publisher-supplier associations
- Note: This adds to data, so use after "Populate Database" or to expand book dataset

**Reset Database** button:
- Clears all data from the database
- Use only if explicitly requested or when a clean slate is needed

### Data Not Generated
The debug page **does not** generate:
- Stock/Inventory data (warehouses, stock quantities)
- Purchase records
- These must be created manually through the app's interfaces if needed

### Example Usage
When asked to work with suppliers and you find no suppliers present:
1. Navigate to `http://localhost:5173/preview/#/debug`
2. Click "Populate Database"
3. Wait for console message "Finished populating database."
4. Navigate to `http://localhost:5173/preview/#/orders/suppliers/`
5. Proceed with the task using the generated suppliers (BooksRUs and NovelSupply Co.)
