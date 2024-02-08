import { BehaviorSubject, firstValueFrom, map, Observable, ReplaySubject, share, Subject, tap } from "rxjs";

import { debug } from "@librocco/shared";

import { DocType } from "@/enums";

import { VersionedString, OrdersDatabaseInterface, CustomerOrderInterface, CustomerOrderData } from "@/types";
import { EmptyCustomerOrderError } from "@/errors";

import { versionId } from "./utils";
import { isEmpty, runAfterCondition, uniqueTimestamp } from "@/utils/misc";
import { newDocumentStream } from "@/utils/pouchdb";

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

	draft = true;
	email = "";
	deposit = 0;
	books: { isbn: string; status: string }[] = [];
	// ordered or ready for pickup => boolean?

	status = "ordered";
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

	private update(ctx: debug.DebugCtx, data: Partial<CustomerOrderInterface>) {
		return runAfterCondition(async () => {
			debug.log(ctx, "customerOrder:update")({ data });

			// Committed notes cannot be updated.
			if (!this.draft) {
				debug.log(ctx, "customerOrder:update:customerOrder_not_draft")(this);
				return this;
			}

			const updatedData = { ...this, ...data, updatedAt: new Date().toISOString() };
			debug.log(ctx, "customerOrder:updating")({ updatedData });
			const { rev } = await this.#db._pouch.put<CustomerOrderData>(updatedData);
			debug.log(ctx, "customerOrder:updated")({ updatedData, rev });

			// We're waiting for the first value from stream (updating local instance) before resolving the
			// update promise.
			await firstValueFrom(this.#updateStream);
			return this;
		}, this.#initialized);
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
		this.updateField("updatedAt", data.updatedAt);
		this.updateField("email", data.email);

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

			const sequentialNumber = (await this.#db._pouch.query("v1_sequence/customer-order")).rows[0];
			const seqIndex = sequentialNumber ? sequentialNumber.value.max && ` (${sequentialNumber.value.max + 1})` : "";

			const initialValues = { ...this, displayName: `Order-${seqIndex}`, updatedAt };
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

	/**
	 * Update customer order status (so far there's ordered and ready-for-pickup).
	 * ready for pickup when all books have been received from supplier
	 * (or some are received and others have to be re-ordered?)
	 */
	updateStatus(ctx: debug.DebugCtx, status: string): Promise<CustomerOrderInterface> {
		const currentStatus = this.status;
		debug.log(ctx, "customerOrder:updateStatus")({ status, currentStatus });

		if (status === currentStatus || !status) {
			debug.log(ctx, "customerOrder:updateStatus:noop")({ status, currentStatus });
			return Promise.resolve(this);
		}

		debug.log(ctx, "customerOrder:updateStatus:updating")({ status });
		return this.update(ctx, { status });
	}

	/**
	 * Update individual book on customer order status.
	 * only the client state (the supplier state is handled elsewere)
	 * @TEMP book status: ordered, received or re-order
	 */
	updateBookStatus(ctx: debug.DebugCtx, isbn: string, status: string): Promise<CustomerOrderInterface> {
		const index = this.books.findIndex((book) => book.isbn === isbn);
		if (index === -1 || this.books[index].status === status) Promise.resolve(this);

		const updatedBooks = [...this.books];
		updatedBooks[index] = { ...updatedBooks[index], status };

		return this.update(ctx, { books: updatedBooks });
	}

	async commit(ctx: debug.DebugCtx): Promise<CustomerOrderInterface> {
		debug.log(ctx, "customerOrder:commit")({});

		if (!this.books.length || !this.email) throw new EmptyCustomerOrderError();

		//sets draft to false
		return this.update(ctx, { draft: false });
	}

	stream() {
		return {
			books: (ctx: debug.DebugCtx) => {
				this.#stream.pipe(
					tap(debug.log(ctx, "customerOrder_streams: books: input")),
					map(({ books }) => books),
					tap(debug.log(ctx, "customerOrder_streams: books: res"))
				);
			},

			state: (ctx: debug.DebugCtx) =>
				this.#stream.pipe(
					tap(debug.log(ctx, "customerOrder_streams: state: input")),
					map(({ draft }) => draft),
					tap(debug.log(ctx, "customerOrder_streams: state: res"))
				),
			status: (ctx: debug.DebugCtx) =>
				this.#stream.pipe(
					tap(debug.log(ctx, "customerOrder_streams: status: input")),
					map(({ status }) => status),
					tap(debug.log(ctx, "customerOrder_streams: status: res"))
				),

			updatedAt: (ctx: debug.DebugCtx) =>
				this.#stream.pipe(
					tap(debug.log(ctx, "customerOrder_streams: updated_at: input")),
					map(({ updatedAt: ua }) => (ua ? new Date(ua) : null)),
					tap(debug.log(ctx, "customerOrder_streams: updated_at: res"))
				)
		};
	}
}

export const newCustomerOrder = (db: OrdersDatabaseInterface, id?: string): CustomerOrderInterface => {
	return new CustomerOrder(db, id);
};
