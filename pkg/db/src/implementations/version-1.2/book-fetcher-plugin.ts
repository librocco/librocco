import { BehaviorSubject, Observable, combineLatest, map, merge, mergeMap, switchMap } from "rxjs";

import { wrapIter } from "@librocco/shared";

import { BookFetchResult, BookFetchResultEntry, BookFetcherPlugin, LibroccoPlugin } from "@/types";
import { fetchBookDataFromSingleSource } from "@/utils/plugins";

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

	fetchBookData(isbns: string[]): BookFetchResult {
		const requests = wrapIter(this.#lookup.entries()).map(([, plugin]) => plugin.fetchBookData(isbns));

		// Stream combines all of the streams of all plugin instances (and flatmaps them)
		const stream = () => merge(requests.map((r) => r.stream())).pipe(mergeMap((x) => x));
		// Promise combines all of the promises from all plugin instances, flattens the results, guaranteeing the same order
		// as the order of plugins in the lookup
		const promise = () => Promise.all(requests.map((r) => r.promise())).then((results) => results.flatMap((r) => r));
		// onResult is a convenience method to subscribe to the stream - this is the equivalent of passing 'onResult' to each plugin
		const onResult = (cb: (r: BookFetchResultEntry[]) => void) => stream().subscribe(cb);

		return { stream, promise, onResult };
	}
}

// type FetchBookDataRes = Awaited<ReturnType<BookFetcherPlugin["fetchBookData"]>>;
// const mergeResults = (prev: FetchBookDataRes, curr: FetchBookDataRes) =>
// 	wrapIter(prev)
// 		.zip(curr)
// 		.map(([_acc, _curr]) => (!_curr ? _acc : { ..._acc, ..._curr }))
// 		.array();

const bookFetcherFallback: BookFetcherPlugin = {
	__name: "fallback",
	// The 'fetchBookData' is expected to return the same number of results as the number of isbns requested
	fetchBookData: fetchBookDataFromSingleSource(async (isbns) => Array(isbns.length).fill(undefined)),
	isAvailableStream: new BehaviorSubject(false)
};
