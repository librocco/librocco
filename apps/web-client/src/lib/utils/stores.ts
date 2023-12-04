import { writable, type Readable, get } from "svelte/store";

export const debouncedStore = <S extends Readable<any>>(store: S, timeout: number): S => {
	let scheduled: NodeJS.Timeout | null = null;

	return {
		subscribe: (notify) => {
			return store.subscribe((value) => {
				if (scheduled) {
					clearTimeout(scheduled);
				}

				scheduled = setTimeout(() => {
					notify(value);
				}, timeout);
			});
		}
	} as S;
};

type ControlledStore<T> = Readable<T> & { flush: () => void };

export function controlledStore<T>(initial: T, store: Readable<T>): ControlledStore<T>;
export function controlledStore<T, R>(initial: R, store: Readable<T>, modify: (a: T) => R): ControlledStore<R>;
export function controlledStore<T, R = T>(
	initial: R,
	store: Readable<T>,
	modify: (a: T) => R = (a) => a as unknown as R
): ControlledStore<R> {
	const internal = writable<R>(initial);

	return {
		subscribe: internal.subscribe,
		flush: () => internal.set(modify(get(store)))
	};
}
