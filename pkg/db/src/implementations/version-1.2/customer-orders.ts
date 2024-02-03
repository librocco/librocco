import { BehaviorSubject, firstValueFrom, Observable, ReplaySubject, share, Subject } from "rxjs";

import { VolumeStock } from "@librocco/shared";

import { DocType } from "@/enums";

import { VersionedString, OrdersDatabaseInterface, CustomerOrderInterface, CustomerOrderData } from "@/types";

import { versionId } from "./utils";
import { isEmpty, isVersioned, runAfterCondition, uniqueTimestamp } from "@/utils/misc";
import { newDocumentStream } from "@/utils/pouchdb";


class CustomerOrder implements CustomerOrderInterface {

	// {
	// 	"id": string, // use 'timestampedId' (or 'timestampId', not sure, it's in the 'db' package, under utils I think
	// 	"draft": boolean,
	// 	"displayName": string, // "name" -> "displayName" to keep consistent with the rest of the app
	// 	"email": string,
	// 	"books": [ 
	// 	  { isbn: string }, // No status for now we can add that later when dealing with supplier orders
	// 	],
	// 	"deposit"?: number // I think the deposit should be calculated on display without persisting and then added when the order is placed
	// 	}

	#db: OrdersDatabaseInterface;

	#initialized = new BehaviorSubject(false);
	#exists = false;

	draft = true;

	orderId = "";
	email = "";
	deposit = 0;

	books = []

	// Update stream receives the latest document (update) stream from the db. It's multicasted using plain RxJS Subject (no repeat or anything).
	// This stream is used to signal the update has happened (and has been streamed to update the instance). Subscribers needing to be notified when
	// an update happens should subscribe to this stream.
	#updateStream: Observable<CustomerOrderData>;
	// The stream is piped from the update stream, only it's multicasted using a ReplaySubject, which will cache the last value emitted by the stream,
	// for all new subscribers. Subscribers needing the latest (up-to-date) data and not needing to be notified when the NEXT update happened, should
	// subscribe to this stream.
	#stream: Observable<CustomerOrderData>;

	// timestramped uid
	_id: VersionedString;
	docType = DocType.CustomerOrder;
	_rev?: string;
	_deleted?: boolean;


	entries: VolumeStock[] = [];
	committed = false;
	displayName = "";
	updatedAt: string | null = null;

	constructor(db: OrdersDatabaseInterface, id?: string) {
		this.#db = db;

		// Store the id internally:
		// - if id is a single segment id, prepend the warehouse id and version the string
		// - if id is a full id, assign it as is
		this._id = !id
			? versionId(`${uniqueTimestamp()}`)
			: isVersioned(id, "v1") // If id is versioned, it's a full id, assign it as is
				? id
				: versionId(`${id}`);



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
		this.updateField("orderId", data.orderId);
		this.updateField("books", data.books);
		this.updateField("deposit", data.deposit);
		this.updateField("docType", data.docType);
		this.updateField("updatedAt", data.updatedAt);
		this.updateField("email", data.email);

		this.#exists = true;

		return this;
	}


	// get(): Promise<CustomerOrderInterface | undefined> {}




	// async commit(ctx: debug.DebugCtx, options?: { force: boolean }): Promise<CustomerOrderInterface> {}



	// stream() {}
}

export const newCustomerOrder = (db: OrdersDatabaseInterface, id?: string): CustomerOrderInterface => {
	return new CustomerOrder(db, id);
};
