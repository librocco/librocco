import { derived, writable, type Readable } from "svelte/store";
import type { IAppDbRx } from "$lib/app/rx";

type ReactiveDataStoreState<T> = {
	ready: boolean;
	busy: boolean;
	data: Partial<T>;
	error: Error | null;
};

export type ReactiveDataStore<T> = Readable<ReactiveDataStoreState<T>>;

export function reactiveDataSource<T>(rx: IAppDbRx, dataLoad: () => Promise<T>, tables: string[], initialData?: T): ReactiveDataStore<T> {
	const readyStore = writable(Boolean(initialData));
	const busyStore = writable(false);
	const dataStore = writable<Partial<T>>(initialData ?? {});
	const errorStore = writable(null);

	const _load = async () => {
		busyStore.set(true);

		try {
			const data = await dataLoad();
			dataStore.set(data);
			errorStore.set(null);
		} catch (error) {
			dataStore.set({});
			errorStore.set(error);
		} finally {
			readyStore.set(true);
			busyStore.set(false);
		}
	};

	let disposer: (() => void) | null = null;

	// The DB reactivity subscription is cold:
	// - we don't subscribe to changes until there's at least one consumer (subscriber)
	//   of the store
	// - we kill the subscription when the last subscriber undubscribes
	const subscribers = new Set();
	const newSubscriber = () => {
		const id = Math.random() * 100_000;
		if (!disposer) {
			disposer = rx.onRange(tables, _load);
		}
		return id;
	};
	const removeSubscriber = (id: number) => {
		subscribers.delete(id);
		if (!subscribers.size && disposer) {
			disposer = null;
		}
	};

	const combinedStore = derived([readyStore, busyStore, dataStore, errorStore], ([ready, busy, data, error]) => ({
		ready,
		busy,
		data,
		error
	}));

	const subscribe: typeof combinedStore.subscribe = (...params) => {
		const id = newSubscriber();
		const unsubscribeCombined = combinedStore.subscribe(...params);

		return () => {
			unsubscribeCombined();
			removeSubscriber(id);
		};
	};

	return { subscribe };
}
