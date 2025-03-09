import { upsertBook } from "$lib/db/cr-sqlite/books";
import { upsertCustomer } from "$lib/db/cr-sqlite/customers";
import type { DbCtx } from "$lib/db/cr-sqlite/db";
import { createReconciliationOrder, upsertReconciliationOrderLines } from "$lib/db/cr-sqlite/order-reconciliation";
import { createSupplierOrder, multiplyString } from "$lib/db/cr-sqlite/suppliers";
import type { Customer, DB, PossibleSupplierOrderLine, Supplier } from "$lib/db/cr-sqlite/types";
import type { BookData } from "@librocco/shared";

/**
* Upserts multiple customers into the database in a single transaction.
* Each customer must have an id and displayId.
* Updates the customers' lastModified timestamp automatically.
*
* @param {DB} db - Database connection
* @param {Array<Omit<Customer, "updatedAt">>} customers - Array of customer
data objects
* @returns {Promise<{success: boolean, inserted: number, updated: number,
errors: Array<{id: string, error: string}>}>}
* @throws {Error} If transaction fails
*/
export async function upsertCustomers(db: DB, customers: Array<Omit<Customer, "updatedAt">>): Promise<void> {
	if (!customers || !Array.isArray(customers) || customers.length === 0) {
		return;
	}

	const errors: Array<{ id: number; error: string }> = [];

	return await db.tx(async (txDb) => {
		for (const customer of customers) {
			// Validate required fields
			if (!customer.id) {
				errors.push({ id: parseInt(customer.displayId), error: "Customer must have an id" });
				continue;
			}

			if (!customer.displayId) {
				errors.push({ id: customer.id, error: "Customer must have a displayId" });
				continue;
			}

			await upsertCustomer(txDb, customer);
		}
	});
}

/**
 * Creates or updates multiple book records in a single transaction.
 * Uses ISBN as the unique identifier for upsert operations.
 * All fields except ISBN are optional and will only be updated if provided.
 *
 * @param {DB} db - Database connection
 * @param {BookData[]} books - Array of book metadata objects
 * @throws {Error} If any book is missing an ISBN
 * @returns {Promise<void>}
 */
export async function upsertBooks(db: DB, books: BookData[]): Promise<void> {
	if (!books.length) {
		return;
	}

	// Validate all books have ISBNs before starting transaction
	for (const book of books) {
		if (!book.isbn) {
			throw new Error("All books must have an ISBN");
		}
	}

	return db.tx(async (tx) => {
		for (const book of books) {
			await upsertBook(tx, book);
		}
	});
}

/**
 * Updates existing suppliers or inserts new ones if they don't exist.
 * Processes multiple suppliers in a single transaction for better performance
 *
 * @param db - The database instance to query
 * @param suppliers - Array of supplier data to upsert
 * @throws {Error} If any supplier is missing an id
 * @returns {Promise<void>}
 */
export async function upsertSuppliers(db: DB, suppliers: Supplier[]): Promise<void> {
	if (!suppliers.length) {
		return;
	}

	// Validate all suppliers have IDs before starting transaction
	for (const supplier of suppliers) {
		if (!supplier.id) {
			throw new Error("All suppliers must have an id");
		}
	}

	return db.tx(async (txDb) => {
		for (const supplier of suppliers) {
			await txDb.exec(
				`INSERT INTO supplier (id, name, email, address)
VALUES (?, ?, ?, ?)
ON CONFLICT(id) DO UPDATE SET
name = COALESCE(?, name),
email = COALESCE(?, email),
address = COALESCE(?, address);`,
				[
					supplier.id,
					supplier.name ?? null,
					supplier.email ?? null,
					supplier.address ?? null,
					supplier.name ?? null,
					supplier.email ?? null,
					supplier.address ?? null
				]
			);
		}
	});
}

/**
* Associates multiple publishers with suppliers in a single transaction.
* If a publisher was associated with a different supplier, that association i
replaced.
*
* @param db - The database instance to query
* @param associations - Array of {supplierId, publisher} pairs to associate
* @returns {Promise<void>}
* @throws {Error} If the array is empty
*/
export async function associatePublishers(db: DB, associations: Array<{ supplierId: number; publisher: string }>): Promise<void> {
	if (!associations.length) {
		return;
	}

	return db.tx(async (txDb) => {
		for (const { supplierId, publisher } of associations) {
			/* Makes sure the given publisher is associated with the given supplier
id.
If necessary it disassociates a different supplier */
			await txDb.exec(
				`
INSERT INTO supplier_publisher (supplier_id, publisher)
VALUES (?, ?)
ON CONFLICT(publisher) DO UPDATE SET
supplier_id = ?
`,
				[supplierId, publisher, supplierId]
			);
		}
	});
}

/**
* Creates multiple supplier orders in a batch.
*
* @param db - The database instance to query
* @param orders - Array of supplier orders to create, each containing:
*                 - id: The ID for the supplier order
*                 - supplierId: The ID of the supplier
*                 - orderLines: The order lines to include in this supplier
order
* @returns Promise resolving when all orders have been created
*/
export async function createSupplierOrders(
	db: DB,
	orders: Array<{
		id: number;
		supplierId: number | null;
		orderLines: Pick<PossibleSupplierOrderLine, "supplier_id" | "isbn" | "quantity">[];
	}>
): Promise<void> {
	// Process each order sequentially to avoid potential conflicts
	for (const order of orders) {
		await createSupplierOrder(db, order.id, order.supplierId, order.orderLines);
	}
}

/**
 * Creates multiple reconciliation orders in a batch.
 *
 * @param db - The database instance to query
 * @param orders - Array of reconciliation orders to create, each containing:
 *                 - id: The ID for the reconciliation order
 *                 - supplierOrderIds: Array of supplier order IDs to reconcil
 * @returns Promise resolving when all reconciliation orders have been created
 * @throws Error if any of the orders fail validation checks
 */
export async function createReconciliationOrders(
	db: DB,
	orders: Array<{
		id: number;
		supplierOrderIds: number[];
	}>
): Promise<void> {
	// Process each reconciliation order sequentially to ensure proper validatio
	for (const order of orders) {
		await createReconciliationOrder(db, order.id, order.supplierOrderIds);
	}
}

/**
* Upserts multiple order lines into multiple reconciliation orders.
* For each reconciliation order, adds new order lines or updates quantities o
existing lines.
* For existing lines, the quantity is added to the current value.
*
* @param db - The database instance to query
* @param orderLinesMap - Map of reconciliation order IDs to arrays of order
lines to upsert
* @returns Promise resolving when all order lines have been upserted
* @throws Error if any reconciliation order is not found or is already
finalized
*/
export async function upsertMultipleReconciliationOrderLines(
	db: DB,
	orderLinesMap: Record<number, Array<{ isbn: string; quantity: number }>>
): Promise<void> {
	// Process each reconciliation order's lines
	for (const [reconciliationOrderId, orderLines] of Object.entries(orderLinesMap)) {
		// Convert string key back to number
		const orderId = parseInt(reconciliationOrderId, 10);

		if (orderLines.length > 0) {
			// Upsert all lines for this reconciliation order
			await upsertReconciliationOrderLines(db, orderId, orderLines);
		}
	}
}
