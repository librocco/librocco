import { Observable } from "rxjs";
import { Readable } from "svelte/store";

/**
 * Creates an observable stream from a svelte store. This is modtly user
 * to simulate the backend db interface from test data is are unlikely to be used in production.
 * @param store svelte store
 * @returns observable stream
 *
 * @TODO duplicate (same one in web-client)
 */
export const observableFromStore = <T>(store: Readable<T>): Observable<T> => {
	return new Observable((subscriber) => {
		const unsubscribe = store.subscribe((value) => {
			subscriber.next(value);
		});
		return unsubscribe;
	});
};
