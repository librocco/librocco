/**
 * An util used to promisify IDBRequest
 */
export function idbPromise<T extends IDBRequest>(req: T): Promise<T["result"]> {
	return new Promise<T["result"]>((resolve, reject) => {
		req.onsuccess = () => {
			resolve(req.result);
		};
		req.onerror = () => {
			reject(req.error);
		};
	});
}

/**
 * A wrapper arount IDBTransaction:
 * - accepts a transaction
 * - runs the (async) setup - equeueing of operations within the transction
 * - commits the transaction
 * - resolves or rejects the promise based on the transaction result
 */
export function idbTxn(transaction: IDBTransaction, setup: (txn: IDBTransaction) => Promise<void>) {
	return new Promise<void>((resolve, reject) => {
		transaction.oncomplete = () => {
			console.log("txn completed");
			resolve();
		};
		transaction.onerror = () => {
			console.error("txn error:", transaction.error);
			reject(transaction.error);
		};
		setup(transaction)
			.then(() => transaction.commit())
			.then(resolve)
			.catch(reject);
	});
}
