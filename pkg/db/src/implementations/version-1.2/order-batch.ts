import { BehaviorSubject, Observable, ReplaySubject, Subject, firstValueFrom, share, tap, map } from "rxjs";

import { debug, OrderItemStatus } from "@librocco/shared";
import { isEmpty, isVersioned, runAfterCondition, uniqueTimestamp } from "@/utils/misc";
import { newDocumentStream } from "@/utils/pouchdb";
import { OrdersDatabaseInterface, OrderBatchInterface, OrderBatchData, VersionedString, OrderItem, SupplierInterface } from "@/types";
import { DocType } from "@/enums";
import { versionId } from "./utils";

class OrderBatch implements OrderBatchInterface {
	_id: VersionedString;
	_rev?: string;
	_deleted?: boolean;

	#db: OrdersDatabaseInterface;
	#supplier: SupplierInterface;
	#initialized = new BehaviorSubject(false);
	#exists = false;

	// Update stream receives the latest document (update) stream from the db. It's multicasted using plain RxJS Subject (no repeat or anything).
	// This stream is used to signal the update has happened (and has been streamed to update the instance). Subscribers needing to be notified when
	// an update happens should subscribe to this stream.
	#updateStream: Observable<OrderBatchData>;
	// The stream is piped from the update stream, only it's multicasted using a ReplaySubject, which will cache the last value emitted by the stream,
	// for all new subscribers. Subscribers needing the latest (up-to-date) data and not needing to be notified when the NEXT update happened, should
	// subscribe to this stream.
	#stream: Observable<OrderBatchData>;

	// book statees: committed - ready for pickup
	items: OrderItem[] = [];
	// date for generating user readable string supplierName_datetime
	date?: string;

	//  state: draft - committed - completed
	state = "draft";
	displayName = "";

	csv: string = "";

	docType = DocType.OrderBatch;
	updatedAt: string | null = null;

	constructor(supplier: SupplierInterface, db: OrdersDatabaseInterface, id?: string) {
		this.#db = db;
		this.#supplier = supplier;

		// should be suppliers/{supplier_id}/orders/{order_id}
		const idSegments = id?.split("/").filter(Boolean) || [];

		// If id provided, validate it:
		// - it should either be a full id - 'v1/<supplier-id>/order/<OrderBatch-id>'
		// - or a single segment id - '<OrderBatch-id>'
		if (id && ![1, 4].includes(idSegments.length)) {
			throw new Error("Invalid supplier order id: " + id);
		}

		// If supplier provided as part of the id, verify there's
		// no mismatch between backreferenced supplier and the provided one.
		if (idSegments.length === 4 && idSegments[1] !== supplier._id) {
			const supplierId = versionId(idSegments[1]);
			const refSupplierId = versionId(supplier._id);
			if (supplierId !== refSupplierId) {
				throw new Error(
					"Supplier referenced in the order and one provided in order id mismatch:" +
						"\n		referenced: " +
						refSupplierId +
						"\n		provided: " +
						supplierId
				);
			}
		}

		// Store the id internally:
		// - if id is a single segment id, prepend the supplier id, and version the string
		// - if id is a full id, assign it as is
		this._id = !id
			? versionId(`${supplier._id}/orders/${uniqueTimestamp()}`)
			: isVersioned(id, "v1") // If id is versioned, it's a full id, assign it as is
			? id
			: versionId(`${supplier._id}/orders/${id}`);

		const updateSubject = new Subject<OrderBatchData>();
		const cache = new ReplaySubject<OrderBatchData>(1);

		this.#updateStream = newDocumentStream<OrderBatchData>({}, this.#db._pouch, this._id).pipe(
			share({
				connector: () => updateSubject,
				resetOnComplete: false,
				resetOnError: false,
				resetOnRefCountZero: false
			})
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
	 * Update field is a method for internal usage, used to update the local field, if the value is provided
	 */
	private updateField<K extends keyof OrderBatchData>(field: K, value?: OrderBatchData[K]) {
		if (value !== undefined) {
			this[field] = value as any;
		}
		this.#exists = true;
		return this;
	}
	/**
	 * Update instance is a method for internal usage, used to update the instance with the data (doesn't update the DB)
	 */
	private updateInstance(data: Partial<Omit<OrderBatchData, "_id">>): OrderBatchInterface {
		// No-op if the data is empty
		if (isEmpty(data)) {
			return this;
		}

		// Update the data with provided fields
		this.updateField("_rev", data._rev);
		this.updateField("docType", data.docType);
		this.updateField("updatedAt", data.updatedAt);
		this.updateField("items", data.items);
		this.updateField("csv", data.csv);
		this.updateField("date", data.date);
		this.updateField("state", data.state);

		this.#exists = true;

		return this;
	}

	private update(ctx: debug.DebugCtx, data: Partial<OrderBatchInterface>) {
		return runAfterCondition(async () => {
			debug.log(ctx, "OrderBatch:update")({ data });

			const updatedData = { ...this, ...data, updatedAt: new Date().toISOString() };
			debug.log(ctx, "OrderBatch:updating")({ updatedData });
			const { rev } = await this.#db._pouch.put<OrderBatchData>(updatedData);
			debug.log(ctx, "OrderBatch:updated")({ updatedData, rev });

			// We're waiting for the first value from stream (updating local instance) before resolving the
			// update promise.
			await firstValueFrom(this.#updateStream);
			return this;
		}, this.#initialized);
	}

	// changes state from draft to committed and creates csv file
	commit(): Promise<OrderBatchInterface> {
		return runAfterCondition(async () => {
			if (this.state !== "draft") {
				return this;
			}

			// generate csv
			const csv = ["isbn", this.items.map(({ isbn }) => isbn).join("\n")].join("\n");

			this.date = new Date().toISOString();

			const { rev } = await this.#db._pouch.put({ ...this, state: "committed", csv });

			/** @TODO calculate book count and total book price */

			return this.updateInstance({ ...this, _rev: rev, state: "committed", csv });
		}, this.#initialized);
	}

	/**
	 * 	changes state from committed to completed
	 * @TODO reconcile book states to ready for pickup/reorder
	 * */
	complete(items: OrderItem[]) {
		return runAfterCondition(async () => {
			if (this.state !== "committed") {
				return this;
			}

			const itemsReduced = items.reduce<Record<string, OrderItemStatus>>((acc, book) => ({ ...acc, [book.isbn]: book.status }), {});

			const updateditems = this.items.map((book) => {
				if (!itemsReduced[book.isbn]) return book;

				return { ...book, state: itemsReduced[book.isbn] };
			});

			const { rev } = await this.#db._pouch.put({ ...this, state: "completed", items: updateditems });

			return this.updateInstance({ ...this, _rev: rev, items: updateditems });
		}, this.#initialized);
	}

	create(): Promise<OrderBatchInterface> {
		return runAfterCondition(async () => {
			if (this.#exists) {
				return this;
			}

			const { rev } = await this.#db._pouch.put(this);

			return this.updateInstance({ ...this, _rev: rev });
		}, this.#initialized);
	}

	delete(ctx: debug.DebugCtx): Promise<OrderBatchInterface> {
		debug.log(ctx, "orderBatch:delete")({});

		return runAfterCondition(async () => {
			if (!this.#exists) {
				return this;
			}

			const { rev } = await this.#db._pouch.put({ ...this, _deleted: true });

			return this.updateInstance({ ...this, _deleted: true, _rev: rev });
		}, this.#initialized);
	}

	addItems(isbns: string[]): Promise<OrderBatchInterface> {
		return runAfterCondition(async () => {
			if (this.state !== "draft") {
				return this;
			}
			isbns.forEach((isbn) => {
				const matchIndex = this.items.findIndex((book) => book.isbn === isbn);

				if (matchIndex === -1) {
					// committed is the default status for items/books
					this.items.push({ isbn, status: OrderItemStatus.Draft });
					return;
				}
			});

			return this.update({}, this);
		}, this.#initialized);
	}

	async getCsv(): Promise<string | undefined> {
		return await this.get().then((orderBatch) => (this.#exists && this.state === "committed" ? orderBatch?.csv : ""));
	}

	get(): Promise<OrderBatchInterface | undefined> {
		return runAfterCondition(async () => {
			if (this.#exists) {
				return this;
			}

			return Promise.resolve(undefined);
		}, this.#initialized);
	}

	stream() {
		return {
			displayName: (ctx: debug.DebugCtx) =>
				this.#stream.pipe(
					tap(debug.log(ctx, "supplier_streams: display_name: input")),
					map(({ displayName }) => displayName || ""),
					tap(debug.log(ctx, "supplier_streams: display_name: res"))
				),
			state: (ctx: debug.DebugCtx) =>
				this.#stream.pipe(
					tap(debug.log(ctx, "supplier_streams: display_name: input")),
					map(({ state }) => state || "draft"),
					tap(debug.log(ctx, "supplier_streams: display_name: res"))
				),
			updatedAt: (ctx: debug.DebugCtx) =>
				this.#stream.pipe(
					tap(debug.log(ctx, "supplier_streams: updated_at: input")),
					map(({ updatedAt: ua }) => (ua ? new Date(ua) : null)),
					tap(debug.log(ctx, "supplier_streams: updated_at: res"))
				),
			items: (ctx: debug.DebugCtx) =>
				this.#stream.pipe(
					tap(debug.log(ctx, "supplier_streams: updated_at: input")),
					map(({ items }) => items || []),
					tap(debug.log(ctx, "supplier_streams: updated_at: res"))
				)
		};
	}
}

export const newOrderBatch = (supplier: SupplierInterface, db: OrdersDatabaseInterface, id?: string): OrderBatchInterface => {
	return new OrderBatch(supplier, db, id);
};
