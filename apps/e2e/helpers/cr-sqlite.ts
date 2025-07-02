import type { DB } from "@vlcn.io/crsqlite-wasm";

import { Page } from "@playwright/test";

import { Customer, Supplier, PossibleSupplierOrderLine } from "./types";

import { BookData } from "@librocco/shared";

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
					(window.removeEventListener("db_ready", finalise), res());
				};
				window.addEventListener("db_ready", finalise);
			}
		});

		return w["_db"] as DB;
	});
}

/**
 * @see apps/web-client/src/lib/db/cr-sqlite/books.ts:upsertBook
 */
export async function upsertBook(db: DB, book: BookData): Promise<void> {
	await window.books.upsertBook(db, book);
}

// #region warehouse

export type Warehouse = {
	id: number;
	displayName?: string | null;
	discount?: number | null;
};

/**
 * @see apps/web-client/src/lib/db/cr-sqlite/warehouse.ts:upsertWarehouse
 */
export async function upsertWarehouse(db: DB, data: Warehouse): Promise<void> {
	await window.warehouse.upsertWarehouse(db, data);
}

// #region notes

/**
 * @see apps/web-client/src/lib/db/cr-sqlite/note.ts:createInboundNote
 */
export async function createInboundNote(db: DB, params: { id: number; warehouseId: number; displayName?: string }): Promise<void> {
	const { warehouseId, id: noteId, displayName } = params;
	await window.note.createInboundNote(db, warehouseId, noteId);
	if (displayName) await window.note.updateNote(db, noteId, { displayName });
}

/**
 * @see apps/web-client/src/lib/db/cr-sqlite/note.ts:createOutboundNote
 */
export async function createOutboundNote(db: DB, params: { id: number; displayName?: string }): Promise<void> {
	const { id, displayName } = params;
	await window.note.createOutboundNote(db, id);
	if (displayName) await window.note.updateNote(db, id, { displayName });
}

/**
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
 * @see apps/web-client/src/lib/db/cr-sqlite/note.ts:addVolumesToNote
 */
export async function addVolumesToNote(db: DB, params: readonly [noteId: number, volume: VolumeStock]): Promise<void> {
	const [id, volume] = params;
	await window.note.addVolumesToNote(db, id, volume);
}

export type NoteCustomItem = { id: number; title: string; price: number };

/**
 * @see apps/web-client/src/lib/db/cr-sqlite/note.ts:upsertNoteCustomItem
 */
export async function upsertNoteCustomItem(db: DB, params: readonly [noteId: number, item: NoteCustomItem]): Promise<void> {
	const [noteId, item] = params;
	await window.note.upsertNoteCustomItem(db, noteId, item);
}

/**
 * @see apps/web-client/src/lib/db/cr-sqlite/note.ts:commitNote
 */
export async function commitNote(db: DB, id: number): Promise<void> {
	// Force is used precisely for test setups, and we don't want additional checks when doing test setup
	await window.note.commitNote(db, id, { force: true });
}

// #region customerOrders

/**
 * @see apps/web-client/src/lib/db/cr-sqlite/customers.ts:upsertCustomer
 */
export async function upsertCustomer(db: DB, customer: Customer) {
	await window.customers.upsertCustomer(db, customer);
}

/**
 * @see apps/web-client/src/lib/db/cr-sqlite/customers.ts:addBooksToCustomer
 */
export const addBooksToCustomer = async (db: DB, params: { customerId: number; bookIsbns: string[] }): Promise<void> => {
	const { customerId, bookIsbns } = params;
	await window.customers.addBooksToCustomer(db, customerId, bookIsbns);
};

// # region suppliers

/**
 * @see apps/web-client/src/lib/db/cr-sqlite/suppliers.ts:upsertSupplier
 */
export async function upsertSupplier(db: DB, supplier: Supplier): Promise<void> {
	await window.suppliers.upsertSupplier(db, supplier);
}

/**
 * @see apps/web-client/src/lib/db/cr-sqlite/suppliers.ts:associatePublisher
 */
export async function associatePublisher(db: DB, params: { supplierId: number; publisher: string }): Promise<void> {
	const { supplierId, publisher } = params;
	await window.suppliers.associatePublisher(db, supplierId, publisher);
}

/**
 * @see apps/web-client/src/lib/db/cr-sqlite/suppliers.ts:createSupplierOrder
 */
export async function createSupplierOrder(
	db: DB,
	params: { id: number; supplierId: number; orderLines: Pick<PossibleSupplierOrderLine, "isbn" | "supplier_id" | "quantity">[] }
): Promise<void> {
	const { id, supplierId, orderLines } = params;
	await window.suppliers.createSupplierOrder(db, id, supplierId, orderLines);
}

// #region reconciliation

/**
 * @see apps/web-client/src/lib/db/cr-sqlite/order-reconciliation.ts:createReconciliationOrder
 */
export async function createReconciliationOrder(db: DB, params: { id: number; supplierOrderIds: number[] }): Promise<void> {
	const { id, supplierOrderIds } = params;
	return await window.reconciliation.createReconciliationOrder(db, id, supplierOrderIds);
}

/**
 * @see apps/web-client/src/lib/db/cr-sqlite/order-reconciliation.ts:finalizeReconciliationOrder
 */
export async function finalizeReconciliationOrder(db: DB, id: number) {
	await window.reconciliation.finalizeReconciliationOrder(db, id);
}

/**
 * E2E test helper for upserting order lines to a reconciliation order.
 * References the original upsertReconciliationOrderLines function.
 * @see apps/web-client/src/lib/db/cr-sqlite/order-reconciliation.ts:upsertReconciliationOrderLines
 */
export async function upsertReconciliationOrderLines(db: DB, params: { id: number; newLines: { isbn: string; quantity: number }[] }) {
	const { id, newLines } = params;
	await window.reconciliation.upsertReconciliationOrderLines(db, id, newLines);
}

/**
 * E2E test helper for unassigning a publisher form a supplier.
 * References the original removePublisherFromSupplier function.
 * @see apps/web-client/src/lib/db/cr-sqlite/suppliers.ts:removePublisherFromSupplier
 */
export async function removePublisherFromSupplier(db: DB, params: { supplierId: number; publisher: string }) {
	const { supplierId, publisher } = params;
	await window.suppliers.removePublisherFromSupplier(db, supplierId, publisher);
}

/**
 * E2E test helper for deleting a reconciliation order.
 * References the original deleteReconciliationOrder function.
 * @see apps/web-client/src/lib/db/cr-sqlite/order-reconciliation.ts:deleteReconciliationOrder
 */
export async function deleteReconciliationOrder(db: DB, id: number): Promise<void> {
	return await window.reconciliation.deleteReconciliationOrder(db, id);
}
