import { OrdersDatabaseInterface, SupplierInterface, SupplierData, VersionedString } from "@/types";
import { debug } from "@librocco/shared";

import { versionId } from "./utils";
import { isEmpty, runAfterCondition, uniqueTimestamp } from "@/utils/misc";
import { BehaviorSubject, Observable, ReplaySubject, Subject, firstValueFrom, map, share, tap } from "rxjs";
import { DocType } from "@/enums";
import { newDocumentStream } from "@/utils/pouchdb";

class Supplier implements SupplierInterface {
	_id: VersionedString;
	_rev?: string;
	_deleted?: boolean;

	#db: OrdersDatabaseInterface;
	#initialized = new BehaviorSubject(false);
	#exists = false;

	// Update stream receives the latest document (update) stream from the db. It's multicasted using plain RxJS Subject (no repeat or anything).
	// This stream is used to signal the update has happened (and has been streamed to update the instance). Subscribers needing to be notified when
	// an update happens should subscribe to this stream.
	#updateStream: Observable<SupplierData>;
	// The stream is piped from the update stream, only it's multicasted using a ReplaySubject, which will cache the last value emitted by the stream,
	// for all new subscribers. Subscribers needing the latest (up-to-date) data and not needing to be notified when the NEXT update happened, should
	// subscribe to this stream.
	#stream: Observable<SupplierData>;

	publishers: string[] = [];
	displayName = "";

	docType = DocType.Supplier;
	updatedAt: string | null = null;

	constructor(db: OrdersDatabaseInterface, id?: string) {
		this.#db = db;

		this._id = id ? versionId(id) : versionId(uniqueTimestamp());

		const updateSubject = new Subject<SupplierData>();
		const cache = new ReplaySubject<SupplierData>(1);

		this.#updateStream = newDocumentStream<SupplierData>({}, this.#db._pouch, this._id).pipe(
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
	private updateField<K extends keyof SupplierData>(field: K, value?: SupplierData[K]) {
		if (value !== undefined) {
			this[field] = value as any;
		}
		this.#exists = true;
		return this;
	}
	/**
	 * Update instance is a method for internal usage, used to update the instance with the data (doesn't update the DB)
	 */
	private updateInstance(data: Partial<Omit<SupplierData, "_id">>): SupplierInterface {
		// No-op if the data is empty
		if (isEmpty(data)) {
			return this;
		}

		// Update the data with provided fields
		this.updateField("_rev", data._rev);
		this.updateField("docType", data.docType);
		this.updateField("updatedAt", data.updatedAt);
		this.updateField("displayName", data.displayName);
		this.updateField("publishers", data.publishers);

		this.#exists = true;

		return this;
	}

	private update(ctx: debug.DebugCtx, data: Partial<SupplierInterface>) {
		return runAfterCondition(async () => {
			debug.log(ctx, "Supplier:update")({ data });

			const updatedData = { ...this, ...data, updatedAt: new Date().toISOString() };
			debug.log(ctx, "Supplier:updating")({ updatedData });
			const { rev } = await this.#db._pouch.put<SupplierData>(updatedData);
			debug.log(ctx, "Supplier:updated")({ updatedData, rev });

			// We're waiting for the first value from stream (updating local instance) before resolving the
			// update promise.
			await firstValueFrom(this.#updateStream);
			return this;
		}, this.#initialized);
	}

	/** @TODO */
	// batch ⇒ supplier.batch(id?)
	// stream ⇒ displayName , publihsers, pendingOrders

	batch() {
		// stream books with status ordered
	}

	create(): Promise<SupplierInterface> {
		// create a supplier doc in the db
		// this.#db._pouch.

		return runAfterCondition(async () => {
			if (this.#exists) {
				return this;
			}

			const sequentialNumber = (await this.#db._pouch.query("v1_sequence/supplier")).rows[0];
			const seqIndex = sequentialNumber ? sequentialNumber.value.max && `${sequentialNumber.value.max + 1}` : "";

			const initialValues = { ...this, displayName: `Supplier-${seqIndex}` };

			const { rev } = await this.#db._pouch.put(initialValues);

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

	addPublisher(ctx: debug.DebugCtx, publisher: string): Promise<SupplierInterface> {
		const index = this.publishers.findIndex((pub) => pub === publisher);
		// check if publisher already exists
		if (index !== -1) Promise.resolve(this);
		const publishers = [...this.publishers, publisher];
		// let booksUpdated = false;

		return this.update(ctx, { publishers });
	}
	removePublisher(ctx: debug.DebugCtx, publisher: string): Promise<SupplierInterface> {
		const publishers = [...this.publishers];

		const index = this.publishers.findIndex((pub) => pub === publisher);
		if (index === -1) Promise.resolve(this);

		publishers.splice(index, 1);

		return this.update(ctx, { publishers });
	}

	get(): Promise<SupplierInterface | undefined> {
		return runAfterCondition(async () => {
			if (this.#exists) {
				return this;
			}

			return Promise.resolve(undefined);
		}, this.#initialized);
	}

	stream() {
		return {
			publishers: (ctx: debug.DebugCtx) => {
				this.#stream.pipe(
					tap(debug.log(ctx, "supplier_streams: publishers: input")),
					map(({ publishers }) => publishers),
					tap(debug.log(ctx, "supplier_streams: publishers: res"))
				);
			},
			displayName: (ctx: debug.DebugCtx) => {
				this.#stream.pipe(
					tap(debug.log(ctx, "supplier_streams: displayName: input")),
					map(({ displayName }) => displayName),
					tap(debug.log(ctx, "supplier_streams: displayName: res"))
				);
			},
			pendingOrders: (ctx: debug.DebugCtx) => {
				this.#stream.pipe(
					tap(debug.log(ctx, "supplier_streams: pendingOrders: input")),
					// map(({ }) => ),
					tap(debug.log(ctx, "supplier_streams: pendingOrders: res"))
				);
			}
		};
	}
}

export const newSupplier = (db: OrdersDatabaseInterface, id?: string): SupplierInterface => {
	return new Supplier(db, id);
};
