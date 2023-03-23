import { readable, type Readable } from "svelte/store";
import { Observable } from "rxjs";

import { debug } from "@librocco/shared";

/**
 * Creates an observable stream from a svelte store. This is modtly user
 * to simulate the backend db interface from test data is are unlikely to be used in production.
 * @param store svelte store
 * @returns observable stream
 */
export const observableFromStore = <T>(store: Readable<T>): Observable<T> => {
	return new Observable((subscriber) => {
		const unsubscribe = store.subscribe((value) => {
			subscriber.next(value);
		});
		return unsubscribe;
	});
};

/**
 * Creates a stream from svelte store that behaves similarly to the derived store. The difference between this
 * and using `observableFromStore` with on an already derived store is that this will invalidate (run the callback) whenever the source store updates,
 * while `observableFromStore` will only run the callback (stream data) if the derived store is updated (which doesn't happen if the derived store holds a
 * primitive value and the value is the same - that, for instance, was causing the display note state not updating the state to 'draft' after an
 * update has been perfored, resulting the display store being stuck in 'saving' temp state).
 * @param store
 * @param fn
 * @returns
 */
export const derivedObservable = <T, U>(store: Readable<T>, fn: (value: T) => U): Observable<U> => {
	return new Observable((subscriber) => {
		const unsubscribe = store.subscribe((value) => {
			subscriber.next(fn(value));
		});
		return unsubscribe;
	});
};

/**
 * Creates a svelte readable store from an observable stream.
 * @param observable observable stream
 * @returns readable store
 */
export const readableFromStream = <T>(observable: Observable<T> | undefined, fallback: T, ctx: debug.DebugCtx): Readable<T> => {
	return readable<T>(fallback, (set) => {
		if (!observable) {
			debug.log(ctx, "readable_from_stream: stream not provided:fallback:")(fallback);
			// eslint-disable-next-line @typescript-eslint/no-empty-function
			return () => {};
		}
		const observer = observable.subscribe((value) => {
			debug.log(ctx, "redable_from_stream:update")(value);
			set(value || fallback);
		});
		return () => observer.unsubscribe();
	});
};
