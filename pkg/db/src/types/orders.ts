/* eslint-disable @typescript-eslint/ban-types */

import { DatabaseInterface as BaseDatabaseInterface, CouchDocument } from "./misc";

export type OrdersDatabaseInterface = BaseDatabaseInterface;

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
}

/** Data structure */
export type SupplierData<A extends Record<string, any> = {}> = CouchDocument<
	{
		updatedAt: string | null;
		publishers: string[];
		displayName: string;
	} & A
>;
/**
 * Standardized supplier order interface
 */

export type SupplierOrderInterface<A extends Record<string, any> = {}> = SupplierOrderProto<A> & SupplierOrderData<A>;

/**
 * Methods interface
 */
export interface SupplierOrderProto<A extends Record<string, any> = {}> {
	create: () => Promise<SupplierOrderInterface<A>>;
}

/** Data structure */
export type SupplierOrderData<A extends Record<string, any> = {}> = CouchDocument<
	{
		updatedAt: string | null;
		books: OrderBook[];
		status: string;
		csv: string;
		date: string;
	} & A
>;

/** A (standardized) customer order interface:
 * * standard data structure
 * * standard method interface
 */

export type CustomerOrderInterface<A extends Record<string, any> = {}> = CustomerOrderProto<A> & CustomerOrderData<A>;

/**
 * A standardized interface (interface of methods) for a customer order.
 * Different implementations might vary, but should always extend this interface.
 */
export interface CustomerOrderProto<A extends Record<string, any> = {}> {
	create: () => Promise<CustomerOrderInterface<A>>;
}

export interface OrderBook {
	isbn: string;
	// status: ordered - ready-for-pickup
	status: string;
}
/**
 * Standardized data that should be present in any customer order
 * (different implementations might differ, but should extend this structure)
 */
export type CustomerOrderData<A extends Record<string, any> = {}> = CouchDocument<
	{
		updatedAt: string | null;
		// equivalent of committed
		draft: boolean;
		email: string;
		deposit: number;
		books: OrderBook[];
		displayName: string;
	} & A
>;
