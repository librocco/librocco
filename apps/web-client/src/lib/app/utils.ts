import type { Readable, Unsubscriber } from "svelte/store";

/**
 * A util turning the store value into a promise
 * @param store
 * @param condition
 * @returns a promise that resolves with the first in-store value that passes the condition
 */
export async function waitForStore<T>(store: Readable<T>, condition: (x: T) => boolean) {
	let unsubscribe: Unsubscriber;

	const promise = new Promise<void>((resolve) => {
		unsubscribe = store.subscribe(($value) => {
			if (condition($value)) {
				resolve();
			}
		});
	});

	await promise;
	unsubscribe();
}
