import type { DB } from "@vlcn.io/crsqlite-wasm";

import { Customer, PlacedSupplierOrder, PlacedSupplierOrderLine, Supplier, CustomerOrderLine, SupplierOrderLine } from "./types";
import { BookData } from "@librocco/shared";

// #region books
import { Page } from "@playwright/test";

import type {} from "./types";

// #region books

// Extend the window object with the db
declare global {
	interface Window {
		_db: DB;
		db_ready: boolean;

		books: Record<string, any>;
		customers: Record<string, any>;
		note: Record<string, any>;
		reconciliation: Record<string, any>;
		suppliers: Record<string, any>;
		warehouse: Record<string, any>;
	}
}

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

		return w["_db"] as DB;
	});
}

export async function upsertBook(db: DB, book: BookData): Promise<void> {
	await window.books.upsertBook(db, book);
}

// #region warehouse

export type Warehouse = {
	id: number;
	displayName?: string | null;
	discount?: number | null;
};

export async function upsertWarehouse(db: DB, data: Warehouse): Promise<void> {
	await window.warehouse.upsertWarehouse(db, data);
}

// #region notes

export async function createInboundNote(db: DB, params: { id: number; warehouseId: number; displayName?: string }): Promise<void> {
	const { warehouseId, id: noteId, displayName } = params;
	await window.note.createInboundNote(db, warehouseId, noteId);
	if (displayName) await window.note.updateNote(db, noteId, { displayName });
}

export async function createOutboundNote(db: DB, params: { id: number; displayName?: string }): Promise<void> {
	const { id, displayName } = params;
	await window.note.createOutboundNote(db, id);
	if (displayName) await window.note.updateNote(db, id, { displayName });
}

/**
 * E2E test helper for updating note metadata.
 * References the original updateNote function.
 * @see apps/web-client/src/lib/db/cr-sqlite/note.ts:updateNote
 */
export async function updateNote(db: DB, payload: { id: number; displayName?: string; defaultWarehouse?: number }): Promise<void> {
	const { id, ...rest } = payload;
	await window.note.updateNote(db, id, rest);
}

// #region note-txns

type VolumeStock = {
	isbn: string;
	quantity: number;
	warehouseId?: number;
};

/**
 * E2E test helper for adding volumes to a note.
 * References the original addVolumesToNote function.
 * @see apps/web-client/src/lib/db/cr-sqlite/note.ts:addVolumesToNote
 */
export async function addVolumesToNote(db: DB, params: readonly [noteId: number, volume: VolumeStock]): Promise<void> {
	const [id, volume] = params;
	await window.note.addVolumesToNote(db, id, volume);
}

export type NoteCustomItem = { id: number; title: string; price: number };

/**
 * E2E test helper for adding or updating custom items in a note.
 * References the original upsertNoteCustomItem function.
 * @see apps/web-client/src/lib/db/cr-sqlite/note.ts:upsertNoteCustomItem
 */
export async function upsertNoteCustomItem(db: DB, params: readonly [noteId: number, item: NoteCustomItem]): Promise<void> {
	const [noteId, item] = params;
	await window.note.upsertNoteCustomItem(db, noteId, item);
}

/**
 * E2E test helper for committing a note.
 * References the original commitNote function.
 * @see apps/web-client/src/lib/db/cr-sqlite/note.ts:commitNote
 */
export async function commitNote(db: DB, id: number): Promise<void> {
	// Force is used precisely for test setups, and we don't want additional checks when doing test setup
	await window.note.commitNote(db, id, { force: true });
}

// #region customerOrders
/**
 * E2E test helper for creating or updating customer data.
 * References the original upsertCustomer function.
 * @see apps/web-client/src/lib/db/cr-sqlite/customers.ts:upsertCustomer
 */
export async function upsertCustomer(db: DB, customer: Customer) {
	await window.customers.upsertCustomer(db, customer);
}

/**
 * E2E test helper for adding books to a customer's order.
 * References the original addBooksToCustomer function.
 * @see apps/web-client/src/lib/db/cr-sqlite/customers.ts:addBooksToCustomer
 */
export const addBooksToCustomer = async (db: DB, params: { customerId: number; bookIsbns: string[] }): Promise<void> => {
	const { customerId, bookIsbns } = params;
	await window.customers.addBooksToCustomer(db, customerId, bookIsbns);
};

/**
 * TODO: I would remove this as I consider direct getters indicate different bad practices in e2e tests (overly complex fixtures or implementation based assertions, instead of behaviour - UI)
 */
export const getCustomerOrderLines = async (db: DB, customerId: number): Promise<CustomerOrderLine[]> => {
	return await window.customers.getCustomerOrderLines(db, customerId);
};

// # region suppliers

export async function upsertSupplier(db: DB, supplier: Supplier): Promise<void> {
	await window.suppliers.upsertSupplier(db, supplier);
}

export async function associatePublisher(db: DB, params: { supplierId: number; publisher: string }): Promise<void> {
	const { supplierId, publisher } = params;
	await window.suppliers.associatePublisher(db, supplierId, publisher);
}

export async function createSupplierOrder(
	db: DB,
	params: { supplierId: number; orderLines: Pick<SupplierOrderLine, "isbn" | "quantity" | "supplier_id">[] }
): Promise<void> {
	const { supplierId, orderLines } = params;
	await window.suppliers.createSupplierOrder(db, supplierId, orderLines);
}

/**
 * @see apps/web-client/src/lib/db/cr-sqlite/suppliers.ts:getPlacedSupplierOrders
 *
 * TODO: I would remove this as I consider direct getters indicate different bad practices in e2e tests (overly complex fixtures or implementation based assertions, instead of behaviour - UI)
 */
export async function getPlacedSupplierOrders(db: DB): Promise<PlacedSupplierOrder[]> {
	return await window.suppliers.getPlacedSupplierOrders(db);
}

/**
 * @see apps/web-client/src/lib/db/cr-sqlite/suppliers.ts:getPlacedSupplierOrders
 *
 * TODO: I would remove this as I consider direct getters indicate different bad practices in e2e tests (overly complex fixtures or implementation based assertions, instead of behaviour - UI)
 */
export async function getPlacedSupplierOrderLines(db: DB, supplier_order_ids: number[]): Promise<PlacedSupplierOrderLine[]> {
	return await window.suppliers.getPlacedSupplierOrderLines(db, supplier_order_ids);
}

// #region reconciliation

/**
 * @see apps/web-client/src/lib/db/cr-sqlite/order-reconciliation.ts:createReconciliationOrder
 */
export async function createReconciliationOrder(db: DB, supplierOrderIds: number[]): Promise<number> {
	return await window.reconciliation.createReconciliationOrder(db, supplierOrderIds);
}

/**
 * E2E test helper for finalizing a reconciliation order.
 * References the original finalizeReconciliationOrder function.
 * @see apps/web-client/src/lib/db/cr-sqlite/order-reconciliation.ts:finalizeReconciliationOrder
 */
export async function finalizeReconciliationOrder(db: DB, id: number) {
	await window.reconciliation.finalizeReconciliationOrder(db, id);
}

/**
 * E2E test helper for adding order lines to a reconciliation order.
 * References the original addOrderLinesToReconciliationOrder function.
 * @see apps/web-client/src/lib/db/cr-sqlite/order-reconciliation.ts:addOrderLinesToReconciliationOrder
 */
export async function addOrderLinesToReconciliationOrder(db: DB, params: { id: number; newLines: { isbn: string; quantity: number }[] }) {
	const { id, newLines } = params;
	await window.reconciliation.addOrderLinesToReconciliationOrder(db, id, newLines);
}
