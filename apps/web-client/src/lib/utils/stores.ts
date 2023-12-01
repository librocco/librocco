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

export const controlledStore = <T>(store: Readable<T>): ControlledStore<T> => {
	const internal = writable<T>();

	return {
		subscribe: internal.subscribe,
		flush: () => internal.set(get(store))
	};
};
