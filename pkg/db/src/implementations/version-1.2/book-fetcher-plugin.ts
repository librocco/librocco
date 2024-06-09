import { BehaviorSubject, Observable, combineLatest, map, switchMap } from "rxjs";

import { wrapIter } from "@librocco/shared";

import { BookEntry, BookFetcherPlugin, LibroccoPlugin } from "@/types";

export class BookFetcherPluginController implements LibroccoPlugin<BookFetcherPlugin> {
	#lookup = new Map<string, BookFetcherPlugin>();
	#availabilityStreams = new BehaviorSubject([] as Observable<boolean>[]);

	__name = "root";

	isAvailableStream = this.#availabilityStreams.pipe(
		// If at least one of the registered implementations is available, the plugin is considered available
		switchMap((streams) => combineLatest(streams).pipe(map(($streams) => $streams.some((s) => s))))
	);

	constructor() {
		this.#lookup.set("fallback", bookFetcherFallback);
		// Register is written as a property and not a method because the plugins interface
		// checks for register using 'Object.hasOwn' and method doesn't get picked up
		//
		// This is necessary in order for the 'register' method to be preserved on the plugin and not overridden
		// by the plugins interface's default method
		this.register = this.register.bind(this);
	}

	register = (plugin: BookFetcherPlugin) => {
		// Add the plugin to the lookup
		// If the plugin is a different instance of the same implementation, it won't be added
		// (same implementation is registered only once)
		this.#lookup.set(plugin.__name, plugin);

		// Reflect any potential updates to in the availability streams.
		//
		// If no plugin was added - no novel implementation was registered, this is an identity operation
		const availabilityStreams = wrapIter(this.#lookup.values())
			.map(({ isAvailableStream }) => isAvailableStream)
			.array();
		this.#availabilityStreams.next(availabilityStreams);

		return this;
	};

	async fetchBookData(isbns: string[]): Promise<(Partial<BookEntry> | undefined)[]> {
		const results = await Promise.all(wrapIter(this.#lookup.entries()).map(([, plugin]) => plugin.fetchBookData(isbns)));
		const init = Array<Partial<BookEntry> | undefined>(isbns.length).fill(undefined);
		return results.reduce(mergeResults, init);
	}
}

type FetchBookDataRes = Awaited<ReturnType<BookFetcherPlugin["fetchBookData"]>>;

const mergeResults = (prev: FetchBookDataRes, curr: FetchBookDataRes) =>
	wrapIter(prev)
		.zip(curr)
		.map(([_acc, _curr]) => (!_curr ? _acc : { ..._acc, ..._curr }))
		.array();

const bookFetcherFallback = {
	__name: "fallback",
	// The 'fetchBookData' is expected to return the same number of results as the number of isbns requested
	fetchBookData: async (isbns: string[]) => Array(isbns.length).fill(undefined),
	isAvailableStream: new BehaviorSubject(false)
};
