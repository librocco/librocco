/**
 * This is a placeholder as we're not using the generic DB, this might change as we add schema, but trying to keep this as a single source of truth
 */
import type { DB as _DB } from "@vlcn.io/crsqlite-wasm";

import type { BookData } from "@librocco/shared";

/**
 * Order tables only show a slice of book data => our order lines only need to return relevant cols
 */
type BookDataCols = Pick<BookData, "isbn" | "title" | "authors" | "publisher" | "price" | "year" | "editedBy" | "outOfPrint" | "category">;

/* Customer orders/books */
export type DBCustomer = {
	id: number;
	fullname?: string;
	email?: string;
	phone?: string;
	displayId: string;
	deposit?: number;
	updated_at?: number;

	// NOTE: I've found the following properties in this type, but they don't exist in the DB schame atm
	// TODO: Check
	// phone?: string;
	// taxId?: string;
};

export type Customer = {
	id: number;
	fullname?: string;
	email?: string;
	phone?: string;
	displayId: string;
	deposit?: number;
	updatedAt?: Date;

	// NOTE: I've found the following properties in this type, but they don't exist in the DB schame atm
	// TODO: Check
	// phone?: string;
	// taxId?: string;
};

/** DB entry retrieved for customer order */
export type DBCustomerOrderListItem = DBCustomer & { status: OrderLineStatus };
export type CustomerOrderListItem = Customer & { completed: boolean };

export enum OrderLineStatus {
	Pending,
	Placed,
	Received,
	Collected
}

export type DBCustomerOrderLine = {
	// A customer order line as it is stored in the database
	id: number;
	isbn: string;
	customer_id: number;
	created: number; // as milliseconds since epoch
	placed?: number; // as milliseconds since epoch
	received?: number; // as milliseconds since epoch
	collected?: number; // as milliseconds since epoch
	status: OrderLineStatus;
};

export type CustomerOrderLine = {
	// A customer order line to be passed around in the application
	id: number;
	customer_id: number;
	created: Date; // Date when the book order was entered
	placed?: Date; // Last date when the book order was placed to the supplier
	received?: Date; // Date when the book order was received from the supplier
	collected?: Date; // Date when the book order was collected by the customer
	status: OrderLineStatus;
} & BookDataCols;

export type CustomerOrderLineHistoryDB = {
	supplierOrderId: number;
	placed: number;
};

export type CustomerOrderLineHistory = {
	supplierOrderId: number;
	placed: Date;
};

/* Suppliers */

/**
 * A supplier table
 */
export type Supplier = {
	id?: number;
	name?: string;
	email?: string;
	address?: string;
	customerId?: number;
};

export type SupplierExtended = Supplier & {
	numPublishers: number;
};

/**
 * Supplier data returned through supplier order & order line joins
 * name and id are prefixed with `supplier_` to avoid conflicts
 */
export type SupplierJoinData = {
	supplier_id: number;
	supplier_name: string;
};

/**
 * A nascent supplier order. It has not yet been placed.
 * Order lines (total books and price) are aggregated form customer orders
 */
export type PossibleSupplierOrder = {
	total_book_number: number;
	total_book_price: number;
} & SupplierJoinData;

/**
 * A placed supplier order: a batch of books ordered on a specific date
 * from the "possible" batch
 */
export type PlacedSupplierOrder = {
	id: number;
	created: number;
	reconciliation_order_id: number | null;
} & PossibleSupplierOrder;

/**
 * Possible order lines are aggregated from customer order lins for a given supplier
 * Book price is multiplied by line quantity => `line_price`
 */
export type PossibleSupplierOrderLine = {
	quantity: number;
	line_price: number;
} & SupplierJoinData &
	Pick<BookData, "isbn" | "title" | "authors" | "price">;

/**
 * Order lines of a placed supplier order
 * Book price is multiplied by line => `line_price`
 */
export type DBPlacedSupplierOrderLine = {
	supplier_order_id: number;
	created: number;
	total_book_number: number;
	total_book_price: number;
	quantity: number;
	line_price: number;
} & SupplierJoinData &
	Omit<BookData, "outOfPrint"> & { out_of_print: number };

export type PlacedSupplierOrderLine = {
	supplier_order_id: number;
	created: number;
	total_book_number: number;
	total_book_price: number;
	quantity: number;
	line_price: number;
} & SupplierJoinData &
	BookData;

/** Raw reconciliation order, returned from DB, before parsing supplier order ids JSON string */
export type DBReconciliationOrder = {
	/** JSON string */
	supplier_order_ids: string;
	created: number;
	id?: number;
	finalized: number;
	updatedAt: number;
};

/**
 * Represents a reconciliation order that groups multiple supplier orders
 * and their associated customer order lines for processing.
 */
export type ReconciliationOrder = {
	supplierOrderIds: number[];
	created: Date;
	id?: number;
	finalized: boolean;
	updatedAt: Date;
};

export type ReconciliationOrderLine = {
	reconciliation_order_id: number;
	isbn: string;
	created: number;
	quantity: number;
	authors: string;
	publisher: string;
	price: number;
	title: string;
};

export type ProcessedOrderLine = ({ supplier_name: string } & BookData) & {
	orderedQuantity: number;
	deliveredQuantity: number;
};
/* Warehouse */
export type Warehouse = {
	id: number;
	displayName: string | null;
	discount: number | null;
};

/* Note */
export type InboundNoteListItem = {
	id: number;
	displayName: string;
	warehouseName: string;
	updatedAt: Date;
	totalBooks: number;
};

export type OutboundNoteListItem = {
	id: number;
	displayName: string;
	updatedAt: Date;
	totalBooks: number;
};

export type VolumeStock = {
	isbn: string;
	quantity: number;
	warehouseId?: number;
};

export type NoteEntriesItem = VolumeStock & {
	warehouseName?: string;
	warehouseDiscount: number;
	updatedAt?: Date;
	committedAt?: Date;
} & Required<Omit<BookData, "updatedAt">>;

export type NoteCustomItem = { id: number; title: string; price: number; updatedAt?: Date };

export type ReceiptItem = {
	isbn?: string; // undefined for custom_item
	title: string;
	quantity: number; // For books read from book_transaction entry, for custom item it is 1
	price: number; // For books - read from books table, for custom items read directly from custom_item entry
	discount: number; // Discount for a respective warehouse (matched by book transaction't warehouse_id), 0 for custom_item
};

export type ReceiptData = {
	items: ReceiptItem[];
	timestamp: number;
};

/* History */
export type PastNoteItem = {
	id: number;
	displayName: string;
	noteType: string;
	totalBooks: number;
	warehouseName: string;
	totalCoverPrice: number;
	totalDiscountedPrice: number;
	committedAt: Date;
};

export type PastTransactionItem = {
	isbn: string;
	title?: string;
	authors?: string;
	quantity: number;
	price: number;
	committedAt: Date;
	warehouseId?: number;
	warehouseName?: string;
	discount: number;
	noteId: number;
	noteName: string;
	noteType: string;
};

/* Misc */

export type NoteType = "inbound" | "outbound";

export type GetStockResponseItem = {
	isbn: string;
	quantity: number;
	warehouseId: number;
	warehouseName: string;
	warehouseDiscount: number;
	title: string;
	price: number;
	year: string;
	authors: string;
	publisher: string;
	editedBy: string;
	outOfPrint: boolean;
	category: string;
};

/** The type of the DB object passed to sqlite DB.tx transaction callback */
export type TXAsync = Parameters<Parameters<_DB["tx"]>[0]>[0];
export type DB = _DB | TXAsync;

/** The transaction returned (thrown) by outbound note commit check - if certin txn will result in negative stock */
export interface OutOfStockTransaction extends VolumeStock {
	warehouseName: string;
	available: number;
}

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

/* Utils */
export type PickPartial<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
