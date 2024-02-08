/* eslint-disable @typescript-eslint/ban-types */

import { DatabaseInterface as BaseDatabaseInterface, CouchDocument } from "./misc";

export type OrdersDatabaseInterface = BaseDatabaseInterface;

export interface NewOrdersDatabase {
	(db: PouchDB.Database): OrdersDatabaseInterface;
}

/**
 * A (standardized) customer order interface:
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
		status: string;

		books: { isbn: string }[];
	} & A
>;
