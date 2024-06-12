import {
	BehaviorSubject,
	Observable,
	Subject,
	combineLatest,
	filter,
	firstValueFrom,
	map,
	merge,
	mergeMap,
	of,
	onErrorResumeNextWith,
	share,
	switchMap
} from "rxjs";

import { wrapIter } from "@librocco/shared";

import { BookFetchOptions, BookFetchResult, BookFetchResultEntry, BookFetcherPlugin, LibroccoPlugin } from "@/types";
import { createSingleSourceBookFetcher } from "@/utils/plugins";

export class BookFetcherPluginController implements LibroccoPlugin<BookFetcherPlugin> {
	#lookup = new Map<string, BookFetcherPlugin>();
	#availabilityStreams = new BehaviorSubject([] as Observable<boolean>[]);

	#fetchedISBNS = new Map<string, BookFetchResult>();
	#fetchingISBNS = new Map<string, BookFetchResult>();

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
		// Same reasoning as above
		this.reset = this.reset.bind(this);
	}

	register = (plugin: BookFetcherPlugin) => {
		// The first time the actual plugin is registered, we're removing the fallback (as it's no longer necessary as a placeolder)
		if (this.#lookup.has("fallback")) {
			this.#lookup.delete("fallback");
		}

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

	reset = () => {
		this.#lookup.clear();
		this.#fetchedISBNS.clear();
		this.#fetchingISBNS.clear();
		return this.register(bookFetcherFallback);
	};

	private _fetchBookData(isbn: string): BookFetchResult {
		const requests = wrapIter(this.#lookup.entries())
			.map(([, plugin]) => plugin.fetchBookData(isbn))
			.array();

		// Stream combines all of the streams of all plugin instances (and flatmaps them).
		// The stream is cached so that if we return the cached value (for repeated request), the observable won't be
		// restarted, which would produce an awkward behavior
		const streamCache = new Subject<BookFetchResultEntry>();
		const stream = () =>
			merge(requests.map((r) => r.stream())).pipe(
				mergeMap((x) => x),
				share({ connector: () => streamCache })
			);
		// First resolves to whichever value is retrieved first.
		// The first value found is the one that is returned, if none is found, resolve to `undefined`
		const first = () => firstValueFrom(stream().pipe(filter(Boolean), onErrorResumeNextWith(of(undefined))));
		// Promise combines all of the promises from all plugin instances, flattens the results, guaranteeing the same order
		// as the order of plugins in the lookup
		const all = () => Promise.all(requests.map((r) => r.all())).then((results) => results.flatMap((r) => r));

		return { first, stream, all };
	}

	fetchBookData(isbn: string, { retryIfAlreadyAttempted = false }: BookFetchOptions = {}): BookFetchResult {
		// Check for cached result (unless explicitly instructed to retry)
		if (this.#fetchedISBNS.has(isbn) && !retryIfAlreadyAttempted) {
			return this.#fetchedISBNS.get(isbn)!;
		}

		// Check for ongoing fetch for the same isbn
		if (this.#fetchingISBNS.has(isbn)) {
			return this.#fetchingISBNS.get(isbn)!;
		}

		const res = this._fetchBookData(isbn);

		// Memoise the results
		this.#fetchingISBNS.set(isbn, res);
		this.#fetchedISBNS.set(isbn, res);

		// Clear the memoized ongoing fetch once the fetch is complete
		res.all().then(() => {
			this.#fetchingISBNS.delete(isbn);
		});

		return res;
	}
}

const bookFetcherFallback = createSingleSourceBookFetcher("fallback", async () => undefined, false);
