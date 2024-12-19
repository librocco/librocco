/**
 * This is a placeholder as we're not using the generic DB, this might change as we add schema, but trying to keep this as a single source of truth
 */
import type { DB } from "@vlcn.io/crsqlite-wasm";
export type { DB };

/* Customer orders/books */
export type Customer = {
	id?: number;
	fullname?: string;
	email?: string;
	phone?: string;
	taxId?: string;
	deposit?: number;
	updatedAt?: number;
};

export type Book = { isbn: string; quantity: number };

export type DBCustomerOrderLine = {
	// A customer order line as it is stored in the database
	id: number;
	isbn: string;
	customer_id: number;
	created: number; // as milliseconds since epoch
	placed?: number; // as milliseconds since epoch
	received?: number; // as milliseconds since epoch
	collected?: number; // as milliseconds since epoch
	supplierOrderIds: string; // Comma separated list of supplier order ids that this book order is part of
};

export type CustomerOrderLine = {
	// A customer order line to be passed around in the application
	id: number;
	isbn: string;
	customer_id: number;
	created: Date; // Date when the book order was entered
	placed?: Date; // Last date when the book order was placed to the supplier
	received?: Date; // Date when the book order was received from the supplier
	collected?: Date; // Date when the book order was collected by the customer
	/**
	 * This will come out from the customer_supplier_order table
	 */
	supplierOrderIds: number[]; // List of supplier order ids that this book order is part of
};
export type BookLine = { isbn: string };

/* Suppliers */
export type SupplierOrderInfo = { supplier_id: number; isbn: string; total_book_number: number };
export type SupplierOrderLine = {
	supplier_id: number;
	supplier_name: string;
	// TODO: extend from Book type (which properties are optional?)
	isbn: string;
	title: string;
	authors: string;
	publisher: string;
	quantity: number;
	line_price: number;
};

export type SupplierPlacedOrder = {
	id: number;
	supplier_name: string;
	supplier_id: number;
	total_book_number: number;
	created: Date;
};
export type Supplier = {
	id?: number;
	name?: string;
	email?: string;
	address?: string;
};

export type SupplierOrder = {
	supplier_id: number;
	created: Date;
	lines: SupplierOrderLine[];
	id: number;
};

/**
 * Represents a reconciliation order that groups multiple supplier orders
 * and their associated customer order lines for processing.
 */
export type ReconciliationOrder = {
	SupplierOrderIds: number[];
	created: Date;
	customer_order_line_ids: string[]; // isbns
	id?: number;
	finalized: boolean;
};

/* Warehouse */
export type Warehouse = {
	id: number;
	displayName: string | null;
	discount: number | null;
};

/* Misc */

/** The type of the DB object passed to sqlite DB.tx transaction callback */
export type TXAsync = Parameters<Parameters<DB["tx"]>[0]>[0];

/* These have been lifted from https://github.com/vlcn-io/js/blob/main/packages/direct-connect-common/src/types.ts
I was unabe to import it from there.
*/

export type Seq = readonly [bigint, number];

export type CID = string;
export type PackedPks = Uint8Array;
export type TableName = string;
export type Version = bigint;
export type CausalLength = bigint;
export type Val = any;

export type Change = readonly [
	TableName,
	PackedPks,
	CID,
	Val,
	Version, // col version
	Version, // db version
	// site_id is omitted. Will be applied by the receiver
	// who always knows site ids in client-server setup.
	// server masks site ids of clients. This masking
	// is disallowed in p2p topologies.
	CausalLength,
	number // seq
];
