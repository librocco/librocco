/* eslint-disable @typescript-eslint/ban-types */

import { Observable } from "rxjs";
import { DatabaseInterface as BaseDatabaseInterface, BooksInterface, CouchDocument } from "./misc";
import { CustomerOrderState, OrderItemStatus, debug } from "@librocco/shared";

export type OrdersDatabaseInterface = BaseDatabaseInterface<{
	books(): BooksInterface;
	customerOrder(id?: string): CustomerOrderInterface;
}>;

export interface NewOrdersDatabase {
	(db: PouchDB.Database): OrdersDatabaseInterface;
}

/**
 * Standardized supplier interface
 */

export type SupplierInterface<A extends Record<string, any> = {}> = SupplierProto<A> & SupplierData<A>;

/**
 * Methods interface
 */
export interface SupplierProto<A extends Record<string, any> = {}> {
	create: () => Promise<SupplierInterface<A>>;

	delete: (ctx: debug.DebugCtx) => Promise<SupplierInterface>;
	setName: (ctx: debug.DebugCtx, name: string) => Promise<SupplierInterface<A>>;
	addPublisher: (ctx: debug.DebugCtx, publisher: string) => Promise<SupplierInterface<A>>;
	removePublisher: (ctx: debug.DebugCtx, publisher: string) => Promise<SupplierInterface<A>>;
	// - returning a SupplierStreams object
	stream: () => SupplierStream;
	//  - leading to the order batch interface
	// batch: () => Promise<SupplierInterface<A>>
}

/**
 * A standardized interface for streams received from a supplier
 */
export interface SupplierStream {
	displayName: (ctx: debug.DebugCtx) => Observable<string>;
	publishers: (ctx: debug.DebugCtx) => Observable<string[]>;
	updatedAt: (ctx: debug.DebugCtx) => Observable<Date | null>;
}

// state

// pendingItems: (ctx: debug.DebugCtx) => Observable<void>;

/** Data structure */
export type SupplierData<A extends Record<string, any> = {}> = CouchDocument<
	{
		updatedAt: string | null;
		publishers: string[];
		displayName: string;
	} & A
>;

/**
 * A standardized interface for streams received from an order batch
 */
export interface OrderBatchStream {
	displayName: (ctx: debug.DebugCtx) => Observable<string>;
	state: (ctx: debug.DebugCtx) => Observable<string>;
	// items: (ctx: debug.DebugCtx) => Observable<string[]>;
	updatedAt: (ctx: debug.DebugCtx) => Observable<Date | null>;
}

/**
 * Standardized supplier order interface
 */

export type OrderBatchInterface<A extends Record<string, any> = {}> = OrderBatchProto<A> & OrderBatchData<A>;

/**
 * Methods interface
 */
export interface OrderBatchProto<A extends Record<string, any> = {}> {
	create: () => Promise<OrderBatchInterface<A>>;
	delete: (ctx: debug.DebugCtx) => Promise<OrderBatchInterface>;
	// - returning a SupplierStreams object
	stream: () => OrderBatchStream;
	// akin to addTransactions in the note interface
	addItems: (isbns: string[]) => Promise<OrderBatchInterface<A>>;

	commit: () => Promise<OrderBatchInterface<A>>;
	getCsv: () => Promise<string | undefined>;
}

/** Data structure */
export type OrderBatchData<A extends Record<string, any> = {}> = CouchDocument<
	{
		updatedAt: string | null;
		items: OrderItem[];
		state: string;
		csv: string;
		date?: string;
		displayName: string;
	} & A
>;

/** A (standardized) customer order interface:
 * * standard data structure
 * * standard method interface
 */

export type CustomerOrderInterface<A extends Record<string, any> = {}> = CustomerOrderProto<A> & CustomerOrderData<A>;

export interface CustomerOrderStream {
	books(ctx: debug.DebugCtx): Observable<OrderItem[]>;
	state(ctx: debug.DebugCtx): Observable<"draft" | "committed">;
	displayName(ctx: debug.DebugCtx): Observable<string>;
	email(ctx: debug.DebugCtx): Observable<string>;
	updatedAt(ctx: debug.DebugCtx): Observable<Date | null>;
}

/**
 * A standardized interface (interface of methods) for a customer order.
 * Different implementations might vary, but should always extend this interface.
 */
export interface CustomerOrderProto<A extends Record<string, any> = {}> {
	// CRUD
	create(): Promise<CustomerOrderInterface<A>>;
	get(): Promise<CustomerOrderInterface<A> | undefined>;
	// NOTE: update is private
	delete(ctx: debug.DebugCtx): Promise<void>;

	/** Set name updates the `displayName` of the note. */
	setName(ctx: debug.DebugCtx, name: string): Promise<CustomerOrderInterface<A>>;
	setEmail(ctx: debug.DebugCtx, email: string): Promise<CustomerOrderInterface<A>>;
	addBooks(ctx: debug.DebugCtx, ...isbns: string[]): Promise<CustomerOrderInterface<A>>;
	removeBooks(ctx: debug.DebugCtx, ...isbns: string[]): Promise<CustomerOrderInterface<A>>;
	/**
	 * Explicitly update an existing transaction row.
	 * The transaction is matched by both isbn and warehouseId.
	 */
	updateBookStatus(ctx: debug.DebugCtx, isbns: string[], status: OrderItemStatus): Promise<string[]>;
	/**
	 * Commit the note, no updates to the note (except updates to `displayName`) can be performed after this.
	 * @param ctx debug context
	 * @param options object
	 * @param options.force force commit, even if the note is empty (this should be used only in tests)
	 */
	commit(ctx: debug.DebugCtx, options?: { force: true }): Promise<CustomerOrderInterface<A>>;
	/**
	 * Stream returns an object containing observable streams for the note:
	 * - `state` - streams the note's `state`
	 * - `displayName` - streams the note's `displayName`
	 * - `updatedAt` - streams the note's `updatedAt`
	 * - `entries` - streams the note's `entries` (volume transactions)
	 */
	stream(): CustomerOrderStream;
}

export interface OrderItem {
	isbn: string;
	status: OrderItemStatus;
}

/**
 * Standardized data that should be present in any customer order
 * (different implementations might differ, but should extend this structure)
 */
export type CustomerOrderData<A extends Record<string, any> = {}> = CouchDocument<
	{
		updatedAt: string | null;
		state: CustomerOrderState;
		email: string;
		deposit: number;
		books: OrderItem[];
		displayName: string;
	} & A
>;
