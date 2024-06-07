import { BookFetcherLookup, BookFetcherPlugin, BookFetcherPluginController, LibroccoPlugin, PluginControllerInterfaceLookup, PluginInterfaceLookup, PluginInterfaceNestedLookup } from "@/types";
import { BehaviorSubject } from "rxjs";

export interface PluginsInterface {
	get<T extends keyof BookFetcherLookup>(pluginName: T): LibroccoPlugin<BookFetcherLookup[T]>;
}

type preBookFetcherPluginController<T extends keyof PluginInterfaceNestedLookup> = (controllerLookup: BookFetcherLookup) => BookFetcherPluginController

class Plugins implements PluginsInterface {
	#lookup: PluginControllerInterfaceLookup;
	#nestedLookup: PluginInterfaceNestedLookup;

	// this should be a generic lookup type
	#bookFetcherLookUp: BookFetcherLookup

	constructor() {
		this.#bookFetcherLookUp = {
			"google-books": bookFetcherFallback,
			"open-library": bookFetcherFallback,
		};
		// nested lookup
		this.#lookup = {
			"book-fetcher": bookFetcherController(this.#bookFetcherLookUp)
		};

		this.#nestedLookup = {
			"book-fetcher": this.#bookFetcherLookUp
		};


	}


	private set<T extends keyof BookFetcherLookup>(pluginName: T): (plugin: BookFetcherLookup[T]) => void {
		return (plugin: BookFetcherLookup[T]) => {
			this.#bookFetcherLookUp[pluginName] = plugin;
		};
	}
	// should set the type ie book fetcher to the controller
	// so when this function is called it should be passed the plugin type as well as the controller
	// the controller is basically the lookup of the plugin type
	private setController<T extends keyof PluginInterfaceNestedLookup>(pluginType: T): (prePluginController: preBookFetcherPluginController<T>) => void {
		return (prePluginController: preBookFetcherPluginController<T>) => {


			// both lookups should have the same keys
			// should be more generic, not just "book-fetcher"
			this.#lookup[pluginType] = () => prePluginController(this.#nestedLookup["book-fetcher"]);

		};
	}

	// find bookFetcherLookUp key using nestedLookup and pluginType nestedLookup[pluginType]
	// using the pluginName, set the actual plugins into bookFetcherLookUp using the pluginName
	get<T extends keyof PluginInterfaceNestedLookup, A extends keyof BookFetcherLookup>(pluginType: T, pluginName: A): LibroccoPlugin<PluginInterfaceNestedLookup[T]> {
		const bookFetcherLookUp = this.#nestedLookup[pluginType];

		const controller = this.#lookup["book-fetcher"]
		const plugin = bookFetcherLookUp[pluginName]


		const register = (plugin: BookFetcherLookup[A]) => {
			bookFetcherLookUp[pluginName] = plugin

			this.set(pluginName)(plugin);
			this.setController("book-fetcher")(controller)

			return Object.assign(plugin, { register });
		};
		return Object.assign(plugin, { register });
	}

}

export const bookFetcherController = (bookFetcherLookUp: BookFetcherLookup) => (): BookFetcherPluginController => ({

	fetchBookData: async (isbns: string[]) => {

		// To be implemented to only return first source that returns books
		const flatMappedBooks = (await Promise.all(Object.values(bookFetcherLookUp).map((bookFetcher: BookFetcherPlugin) => {
			return (bookFetcher.fetchBookData(isbns))

		}))).flatMap((books) => books)

		return flatMappedBooks
	},
	isAvailableStream: new BehaviorSubject(false)
}
)
// #region fallbacks
const bookFetcherFallback = {
	// The 'fetchBookData' is expected to return the same number of results as the number of isbns requested
	fetchBookData: async (isbns: string[]) => Array(isbns.length).fill(undefined),
	isAvailableStream: new BehaviorSubject(false)
};
// #endregion fallbacks

export const newPluginsInterface = () => new Plugins();
