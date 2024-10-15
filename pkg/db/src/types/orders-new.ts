export interface OrdersDatabaseInterface {
	/**
	 * Creates a new instance of customer order interface, used
	 * create new or access existing customer order
	 */
	customerOrder(id?: number | string): CustomerOrderInterface;
	/**
	 * Creates a new supplier instance, used to create new, or access
	 * existing supplier - create new orders, edit supplier data, etc.
	 */
	supplier(id?: number | string): SupplierInterface;
	/**
	 * Lists all publishers and their associated suppliers
	 */
	listPublishers(): Promise<Array<{ publisher: string; supplierId: number; supplierName: string }>>;
	/**
	 * Lists all orders that can, potentially, be created out of standing customer orders and
	 * placed with respective suppliers
	 */
	listPlacableOrders(): Promise<PlacableSupplierOrder>;
}

// #region customer orders
export interface OrderLine {
	id: number;
	isbn: string;
	state: OrderLineState;

	/**
	 * Ids of all supplier orders this order line was a part of. This is an array, not a single
	 * value as there might be more supplier orders in case the order line needs to be reordered.
	 */
	associatedSupplierOrders: string[];

	/** The date the order was placed by a customer */
	createdAt: string | null;
	/** Time of the last time the order line was ordered with a suplier */
	orderedAt: string | null;
	/** The date the order was delivered by a supplier */
	deliveredAt: string | null;
	/** The date the order was picked up by the customer */
	collectedAt: string | null;
}

/**
 * An isbn => quantity record used to create/reconcile order lines.
 */
type OrdersRecord = {
	[isbn: string]: number;
};

export interface CustomerOrderData {
	id: number;
	name: string;
	surname: string;
	email: string;
}

export interface CustomerOrderInterface {
	/**
	 * Creates a new customer order: persists the order in the db. At that point, the order is placed, there might be some limited
	 * editing after this point, but the order lines are "in queue", pending to be placed with respective supplier.
	 */
	create(data: Pick<CustomerOrderData, "name" | "surname" | "email">, books: OrdersRecord): Promise<CustomerOrderInterface>;
	/** Update customer order data (name, surname, email). For order line additions/removals */
	updateData(data: Partial<Pick<CustomerOrderData, "name" | "surname" | "email">>): Promise<CustomerOrderInterface>;
	/** Get customer order data from the DB, for order lines within the order, see `.getItems` */
	get(): Promise<CustomerOrderData>;

	/** Add order lines to the order */
	addItems(items: OrdersRecord): Promise<void>;
	/** Remove order lines from the order */
	removeItems(items: OrdersRecord): Promise<void>;
	/** Get order lines for the order */
	getItems(): Promise<OrderLine[]>;

	stream(): {
		// TODO
	};
}

// #region supplier
export interface SupplierData {
	id: number; // Probably a number...
	name: string;
	email: string;
	publishers: Publisher[];
}

export type Publisher = string;

export interface SupplierInterface {
	/** Create a new supplier with initial data. This persists the supplier data in the DB. */
	create(data: Pick<SupplierData, "name" | "email">): Promise<SupplierInterface>;

	/**
	 * Associate a publisher with the supplier. We allow only one supplier per publisher:
	 * if a publisher is already associated with another supplier, it is removed from its
	 * pubishers list and added to the current supplier.
	 */
	associatePublisher(name: string): Promise<void>;

	/** Get supplier data */
	get(): SupplierData;

	/** Instantiate a new supplier order interface */
	order(id?: number): SupplierOrderInterface;
}

export interface SupplierOrderData {
	id: number;
	supplierId: number;

	items: OrderLine[];

	/** The time the order is marked as having been placed (if this is not null, the order had been placed with a suplier) */
	placedAt: string | null;
	/** The time the order was finalised: books received from the supplier, and reconciled (if this is not null, the order is finalised) */
	finalisedAt: string | null;
}

export type PlacableSupplierOrder = Pick<SupplierOrderData, "supplierId" | "items">;

export interface SupplierOrderInterface {
	/**
	 * Create a supplier order from a placable order (suggestion). This persists the order,
	 * but doesn't mark it as placed (see `.place`)
	 */
	create(data: PlacableSupplierOrder): Promise<SupplierOrderInterface>;
	/** The order placement happens outside the app. This method is ran to, simply, mark the order as placed (and timestamp it) */
	place(): Promise<SupplierOrderInterface>;
	/** Get order data, including order lines */
	get(): Promise<SupplierOrderData>;
	/**
	 * Finalise the supplier order, This means a batch of books was delivered. The supplier order,
	 * and its respective order lines, are reconciled:
	 *	- the majority of order lines will be filled (marked as ready for customer to collect)
	 *	- some of the order lines might not be filled (or be partially filled)
	 *	- all of the non-filled order lines are returned to `pending` state awaiting to be ordered in the next supplier order
	 */
	finalize(deliveredBooks: OrdersRecord): Promise<void>;

	stream(): {
		// TODO
	};
}

// #region misc
export enum OrderLineState {
	Pending = 0,
	Placed = 1,
	Received = 2,
	Collected = 3
}
