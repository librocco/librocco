import { BehaviorSubject, firstValueFrom, map, Observable, ReplaySubject, share, Subject, tap } from "rxjs";

import { CustomerOrderState, debug, OrderItemStatus } from "@librocco/shared";

import { DocType } from "@/enums";

import {
	VersionedString,
	OrdersDatabaseInterface,
	CustomerOrderInterface,
	CustomerOrderData,
	CustomerOrderStream,
	OrderItem
} from "@/types";
import { EmptyCustomerOrderError } from "@/errors";

import { isEmpty, runAfterCondition, uniqueTimestamp } from "@/utils/misc";
import { newDocumentStream } from "@/utils/pouchdb";
import { versionId } from "./utils";

class CustomerOrder implements CustomerOrderInterface {
	_id: VersionedString;
	_rev?: string;
	_deleted?: boolean;

	#db: OrdersDatabaseInterface;
	#initialized = new BehaviorSubject(false);
	#exists = false;

	// Update stream receives the latest document (update) stream from the db. It's multicasted using plain RxJS Subject (no repeat or anything).
	// This stream is used to signal the update has happened (and has been streamed to update the instance). Subscribers needing to be notified when
	// an update happens should subscribe to this stream.
	#updateStream: Observable<CustomerOrderData>;
	// The stream is piped from the update stream, only it's multicasted using a ReplaySubject, which will cache the last value emitted by the stream,
	// for all new subscribers. Subscribers needing the latest (up-to-date) data and not needing to be notified when the NEXT update happened, should
	// subscribe to this stream.
	#stream: Observable<CustomerOrderData>;

	state: CustomerOrderState = CustomerOrderState.Draft;
	email = "";
	deposit = 0;
	books: OrderItem[] = [];
	displayName = "";

	docType = DocType.CustomerOrder;
	updatedAt: string | null = null;

	constructor(db: OrdersDatabaseInterface, id?: string) {
		this.#db = db;

		// Store the id internally:
		// - if id is a single segment id, prepend the warehouse id and version the string
		// - if id is a full id, assign it as is
		this._id = !id ? versionId(`${uniqueTimestamp()}`) : versionId(`${id}`);

		// Create the internal document stream, which will be used to update the local instance on each change in the db.
		const updateSubject = new Subject<CustomerOrderData>();
		const cache = new ReplaySubject<CustomerOrderData>(1);
		this.#updateStream = newDocumentStream<CustomerOrderData>({}, this.#db._pouch, this._id).pipe(
			share({ connector: () => updateSubject, resetOnError: false, resetOnComplete: false, resetOnRefCountZero: false })
		);
		this.#stream = this.#updateStream.pipe(
			// We're connecting the stream to a ReplaySubject as a multicast object: this enables us to share the internal stream
			// with the exposed streams (orderId??) and to cache the last value emitted by the stream: so that each subscriber to the stream
			// will get the 'initialValue' (repeated value from the latest stream).
			share({ connector: () => cache, resetOnError: false, resetOnComplete: false, resetOnRefCountZero: false })
		);

		// The first value from the stream will be either customer order data, or an empty object (if the customer order doesn't exist in the db).
		// This is enough to signal that the customer order intsance is initialised.
		firstValueFrom(this.#stream).then(() => this.#initialized.next(true));
		// If data is not empty (customer order exists), setting of 'exists' flag is handled inside the 'updateInstance' method.
		this.#stream.subscribe((w) => this.updateInstance(w));
		return this;
	}

	/**
	 * A convenience method used to update the document in the db.
	 *
	 * _Note: this is a general purpose update (forced, if you will), used for updates
	 * that should bypass the "draft" state. For regular updates use `this.update` method._
	 */
	private updateDocument(ctx: debug.DebugCtx, update: Partial<CustomerOrderData>) {
		return runAfterCondition(async () => {
			const updatedData = { ...this, ...update };
			debug.log(ctx, "customer_order:update_document")({ updatedData });

			const { rev } = await this.#db._pouch.put<CustomerOrderData>(updatedData);
			debug.log(ctx, "customer_order:updated")({ updatedData, rev });

			// We're waiting for the first value from stream (updating local instance) before resolving the
			// update promise.
			await firstValueFrom(this.#updateStream);

			return this;
		}, this.#initialized);
	}

	/**
	 * Update to be used for draft state operations - it performs a state check and performs the update **only** if the order is in draft state.
	 */
	private update(ctx: debug.DebugCtx, _update: (data: this) => Partial<CustomerOrderInterface>) {
		// Only draft orders can be updated.
		if (this.state === "committed") {
			debug.log(ctx, "customer_order:update:order-already-placed")(this);
			return Promise.resolve(this);
		}

		// Get the resulting data from update function
		const data = _update(this);

		return this.updateDocument(ctx, data);
	}

	/**
	 * Update field is a method for internal usage, used to update the local field, if the value is provided
	 */
	private updateField<K extends keyof CustomerOrderData>(field: K, value?: CustomerOrderData[K]) {
		if (value !== undefined) {
			this[field] = value as any;
		}
		this.#exists = true;
		return this;
	}
	/**
	 * Update instance is a method for internal usage, used to update the instance with the data (doesn't update the DB)
	 */
	private updateInstance(data: Partial<Omit<CustomerOrderData, "_id">>): CustomerOrderInterface {
		// No-op if the data is empty
		if (isEmpty(data)) {
			return this;
		}

		// Update the data with provided fields
		this.updateField("_rev", data._rev);
		this.updateField("books", data.books);
		this.updateField("deposit", data.deposit);
		this.updateField("docType", data.docType);
		this.updateField("displayName", data.displayName);
		this.updateField("updatedAt", data.updatedAt);
		this.updateField("email", data.email);
		this.updateField("state", data.state);

		this.#exists = true;

		return this;
	}

	/**
	 * If order doesn't exist in the db, create an order with initial values.
	 * No-op otherwise.
	 */
	create(): Promise<CustomerOrderInterface> {
		return runAfterCondition(async () => {
			if (this.#exists) {
				return this;
			}

			const updatedAt = new Date().toISOString();

			const seqDesignRes = await this.#db._pouch.query("v1_sequence/customer-order");
			const seqIndex = (seqDesignRes.rows[0]?.value?.max || 0) + 1;

			const initialValues = {
				...this,
				displayName: `Order-${seqIndex}`,
				updatedAt
			};
			const { rev } = await this.#db._pouch.put<CustomerOrderData>(initialValues);

			return this.updateInstance({ ...initialValues, _rev: rev });
		}, this.#initialized);
	}

	get(): Promise<CustomerOrderInterface | undefined> {
		return runAfterCondition(async () => {
			if (this.#exists) {
				return this;
			}

			return Promise.resolve(undefined);
		}, this.#initialized);
	}

	setEmail(ctx: debug.DebugCtx, email: string): Promise<CustomerOrderInterface> {
		return this.update(ctx, () => ({ email }));
	}

	setName(ctx: debug.DebugCtx, displayName: string): Promise<CustomerOrderInterface> {
		return this.update(ctx, () => ({ displayName }));
	}

	// TODO
	delete(): Promise<void> {
		console.error("TODO: Delete not implemented");
		return Promise.resolve();
	}

	addBooks(ctx: debug.DebugCtx, ...isbns: string[]): Promise<CustomerOrderInterface> {
		return this.update(ctx, (data) => {
			const updates = isbns.map((isbn) => ({ isbn, status: OrderItemStatus.Draft }));
			const books = data.books.concat(updates);
			return { books };
		});
	}

	removeBooks(ctx: debug.DebugCtx, ...isbns: string[]): Promise<CustomerOrderInterface> {
		return this.update(ctx, (data) => {
			const books = [...data.books];
			for (const isbn of isbns) {
				const index = this.books.findIndex((book) => book.isbn === isbn);
				if (index === -1) continue;
				books.splice(index, 1);
			}
			return { books };
		});
	}

	/**
	 * A helper for 'updateBookStatus' applied to a single row.
	 * The update is applied to the first book with the matching isbn and different status (not yet updated).
	 * Returns a boolean indicating if the update was successful.
	 *
	 * _Note: this method updates the local state only, the document update should be ran to persist the change._
	 */
	private _updateBookStatus(isbn: string, status: OrderItemStatus): boolean {
		const index = this.books.findIndex((book) => book.isbn === isbn && book.status !== status);
		if (index === -1) return false;
		this.books[index].status = status;
		return true;
	}

	/**
	 * Update individual book on customer order status.
	 * only the client state (the supplier state is handled elsewere)
	 */
	async updateBookStatus(ctx: debug.DebugCtx, isbns: string[], status: OrderItemStatus): Promise<string[]> {
		debug.log(ctx, "customer_order:update_book_status")({ isbns, status });

		const updatedBooks = [...this.books];

		const toUpdate = isbns.map((isbn) => ({ isbn, updated: false }));

		for (const item of toUpdate) {
			item.updated = this._updateBookStatus(item.isbn, status);
		}

		await this.updateDocument(ctx, { books: updatedBooks });

		// Remove updated items from the list. We're returning the residual for further processing
		const residual = toUpdate.filter(({ updated }) => !updated).map((item) => item.isbn);
		debug.log(ctx, "customer_order:update_book_status:residual")({ residual });

		return residual;
	}

	async commit(ctx: debug.DebugCtx): Promise<CustomerOrderInterface> {
		debug.log(ctx, "customer_order:commit")({});

		if (!this.books.length || !this.email) throw new EmptyCustomerOrderError();

		return this.update(ctx, () => ({
			state: CustomerOrderState.Committed,
			books: this.books.map(({ isbn }) => ({ isbn, status: OrderItemStatus.Placed }))
		}));
	}

	stream(): CustomerOrderStream {
		return {
			books: (ctx: debug.DebugCtx) =>
				this.#stream.pipe(
					tap(debug.log(ctx, "customer_order_streams: books: input")),
					map(({ books }) => books?.sort(({ isbn: i1, status: s1 }, { isbn: i2, status: s2 }) => (i1 < i2 ? -1 : i1 > i2 ? 1 : s2 - s1))),
					tap(debug.log(ctx, "customer_order_streams: books: res"))
				),

			state: (ctx: debug.DebugCtx) =>
				this.#stream.pipe(
					tap(debug.log(ctx, "customer_order_streams: state: input")),
					map(({ state }) => state),
					tap(debug.log(ctx, "customer_order_streams: state: res"))
				),

			displayName: (ctx: debug.DebugCtx) =>
				this.#stream.pipe(
					tap(debug.log(ctx, "customer_order_streams: display_name: input")),
					map(({ displayName }) => displayName),
					tap(debug.log(ctx, "customer_order_streams: display_name: res"))
				),

			email: (ctx: debug.DebugCtx) =>
				this.#stream.pipe(
					tap(debug.log(ctx, "customer_order_streams: email: input")),
					map(({ email }) => email),
					tap(debug.log(ctx, "customer_order_streams: email: res"))
				),

			updatedAt: (ctx: debug.DebugCtx) =>
				this.#stream.pipe(
					tap(debug.log(ctx, "customer_order_streams: updated_at: input")),
					map(({ updatedAt: ua }) => (ua ? new Date(ua) : null)),
					tap(debug.log(ctx, "customer_order_streams: updated_at: res"))
				)
		};
	}
}

export const newCustomerOrder = (db: OrdersDatabaseInterface, id?: string): CustomerOrderInterface => {
	return new CustomerOrder(db, id);
};
