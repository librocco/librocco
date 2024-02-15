import { BehaviorSubject, Observable, ReplaySubject, Subject, firstValueFrom, share, tap } from "rxjs";

import { debug } from "@librocco/shared";
import { isEmpty, runAfterCondition, uniqueTimestamp } from "@/utils/misc";
import { newDocumentStream } from "@/utils/pouchdb";
import { OrdersDatabaseInterface, SupplierOrderInterface, SupplierOrderData, VersionedString, OrderBook } from "@/types";
import { DocType } from "@/enums";
import { versionId } from "./utils";

class SupplierOrder implements SupplierOrderInterface {
	_id: VersionedString;
	_rev?: string;
	_deleted?: boolean;

	#db: OrdersDatabaseInterface;
	#initialized = new BehaviorSubject(false);
	#exists = false;

	// Update stream receives the latest document (update) stream from the db. It's multicasted using plain RxJS Subject (no repeat or anything).
	// This stream is used to signal the update has happened (and has been streamed to update the instance). Subscribers needing to be notified when
	// an update happens should subscribe to this stream.
	#updateStream: Observable<SupplierOrderData>;
	// The stream is piped from the update stream, only it's multicasted using a ReplaySubject, which will cache the last value emitted by the stream,
	// for all new subscribers. Subscribers needing the latest (up-to-date) data and not needing to be notified when the NEXT update happened, should
	// subscribe to this stream.
	#stream: Observable<SupplierOrderData>;

	// book statuses: ordered - ready for pickup
	books: OrderBook[] = [];
	// date for generating user readable string supplierName_datetime
	date: string;

	//  status: draft - ordered - completed
	status = "draft";

	csv: string = "";

	docType = DocType.Supplier;
	updatedAt: string | null = null;

	constructor(db: OrdersDatabaseInterface, id?: string) {
		this.#db = db;

		this._id = id ? versionId(id) : versionId(uniqueTimestamp());
		this.date = new Date().toISOString();

		const updateSubject = new Subject<SupplierOrderData>();
		const cache = new ReplaySubject<SupplierOrderData>(1);

		this.#updateStream = newDocumentStream<SupplierOrderData>({}, this.#db._pouch, this._id).pipe(
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
	private updateField<K extends keyof SupplierOrderData>(field: K, value?: SupplierOrderData[K]) {
		if (value !== undefined) {
			this[field] = value as any;
		}
		this.#exists = true;
		return this;
	}
	/**
	 * Update instance is a method for internal usage, used to update the instance with the data (doesn't update the DB)
	 */
	private updateInstance(data: Partial<Omit<SupplierOrderData, "_id">>): SupplierOrderInterface {
		// No-op if the data is empty
		if (isEmpty(data)) {
			return this;
		}

		// Update the data with provided fields
		this.updateField("_rev", data._rev);
		this.updateField("docType", data.docType);
		this.updateField("updatedAt", data.updatedAt);
		this.updateField("books", data.books);
		this.updateField("csv", data.csv);
		this.updateField("date", data.date);
		this.updateField("status", data.status);

		this.#exists = true;

		return this;
	}

	private update(ctx: debug.DebugCtx, data: Partial<SupplierOrderInterface>) {
		return runAfterCondition(async () => {
			debug.log(ctx, "supplierOrder:update")({ data });

			const updatedData = { ...this, ...data, updatedAt: new Date().toISOString() };
			debug.log(ctx, "supplierOrder:updating")({ updatedData });
			const { rev } = await this.#db._pouch.put<SupplierOrderData>(updatedData);
			debug.log(ctx, "supplierOrder:updated")({ updatedData, rev });

			// We're waiting for the first value from stream (updating local instance) before resolving the
			// update promise.
			await firstValueFrom(this.#updateStream);
			return this;
		}, this.#initialized);
	}

	order() {
		// change status from draft to ordered and creates csv file
		return runAfterCondition(async () => {
			if (this.status !== "draft") {
				return this;
			}

			// generate csv
			const csv = ["isbn", this.books.map(({ isbn }) => isbn).join("\n")].join("\n");

			const { rev } = await this.#db._pouch.put({ ...this, status: "ordered", csv });

			return this.updateInstance({ ...this, _rev: rev, status: "ordered", csv });
		}, this.#initialized);
	}

	// change status from ordered to completed
	// reconcile book states to ready for pickup/reorder
	complete(books: OrderBook[]) {
		return runAfterCondition(async () => {
			if (this.status !== "ordered") {
				return this;
			}

			const booksReduced = books.reduce<Record<string, string>>((acc, book) => ({ ...acc, [book.isbn]: book.status }), {});

			const updatedBooks = this.books.map((book) => {
				if (!booksReduced[book.isbn]) return book;

				return { ...book, status: booksReduced[book.isbn] };
			});

			const { rev } = await this.#db._pouch.put({ ...this, status: "completed", books: updatedBooks });

			return this.updateInstance({ ...this, _rev: rev, books: updatedBooks });
		}, this.#initialized);
	}

	create(): Promise<SupplierOrderInterface> {
		return runAfterCondition(async () => {
			if (this.#exists) {
				return this;
			}

			const { rev } = await this.#db._pouch.put(this);

			return this.updateInstance({ ...this, _rev: rev });
		}, this.#initialized);
	}

	delete() {
		return runAfterCondition(async () => {
			if (!this.#exists) {
				return this;
			}

			const { rev } = await this.#db._pouch.put({ ...this, _deleted: true });

			return this.updateInstance({ ...this, _deleted: true, _rev: rev });
		}, this.#initialized);
	}

	addBooks(isbns: string[]): Promise<SupplierOrderInterface> {
		return runAfterCondition(async () => {
			if (this.status !== "draft") {
				return this;
			}
			isbns.forEach((isbn) => {
				const matchIndex = this.books.findIndex((book) => book.isbn === isbn);

				if (matchIndex === -1) {
					// ordered is the default status for books
					this.books.push({ isbn, status: "ordered" });
					return;
				}
			});

			return this.update({}, this);
		}, this.#initialized);
	}

	get(): Promise<SupplierOrderInterface | undefined> {
		return runAfterCondition(async () => {
			if (this.#exists) {
				return this;
			}

			return Promise.resolve(undefined);
		}, this.#initialized);
	}

	stream(ctx: debug.DebugCtx) {
		return this.#stream.pipe(tap(debug.log(ctx, "supplierOrder_stream")));
	}
}

export const newSupplierOrder = (db: OrdersDatabaseInterface, id?: string): SupplierOrderInterface => {
	return new SupplierOrder(db, id);
};
