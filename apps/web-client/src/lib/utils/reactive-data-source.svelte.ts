import { createSubscriber } from "svelte/reactivity";

import type { IAppDbRx } from "$lib/app/rx";

type ReactiveDataStoreState<T> = {
	ready: boolean;
	busy: boolean;
	data: Partial<T>;
	error: Error | null;
};

export class ReactiveDataStore<T> {
	#ready = $state(false);
	#busy = $state(false);
	#data = $state<Partial<T>>({});
	#error = $state<Error | null>(null);

	#subscribe: () => void;
	#dataLoad: () => Promise<T>;

	constructor(rx: IAppDbRx, dataLoad: () => Promise<T>, tables: string[], initialData?: T) {
		this.#ready = Boolean(initialData);
		this.#data = initialData ?? {};
		this.#dataLoad = dataLoad;

		this.#subscribe = createSubscriber((update) => {
			const onRangeChange = async () => {
				await this.load();
				update();
			};

			return rx.onRange(tables, onRangeChange);
		});
	}

	get ready(): boolean {
		this.#subscribe();
		return this.#ready;
	}

	get busy(): boolean {
		this.#subscribe();
		return this.#busy;
	}

	get data(): Partial<T> {
		this.#subscribe();
		return this.#data;
	}

	get error(): Error | null {
		this.#subscribe();
		return this.#error;
	}

	get state(): ReactiveDataStoreState<T> {
		this.#subscribe();
		return {
			ready: this.#ready,
			busy: this.#busy,
			data: this.#data,
			error: this.#error
		};
	}

	private async load(): Promise<void> {
		this.#busy = true;

		try {
			this.#data = await this.#dataLoad();
			this.#error = null;
		} catch (error) {
			this.#data = {};
			this.#error = error as Error;
		} finally {
			this.#ready = true;
			this.#busy = false;
		}
	}
}

export function reactiveDataSource<T>(rx: IAppDbRx, dataLoad: () => Promise<T>, tables: string[], initialData?: T): ReactiveDataStore<T> {
	return new ReactiveDataStore(rx, dataLoad, tables, initialData);
}
