import { LibroccoPlugin, PluginInterfaceLookup } from "@/types";
import { BehaviorSubject } from "rxjs";

export interface PluginsInterface {
	get<T extends keyof PluginInterfaceLookup>(pluginName: T): LibroccoPlugin<PluginInterfaceLookup[T]>;
}

class Plugins implements PluginsInterface {
	#lookup: PluginInterfaceLookup;

	constructor() {
		this.#lookup = {
			"book-fetcher": bookFetcherFallback
		};
	}

	private set<T extends keyof PluginInterfaceLookup>(pluginName: T): (plugin: PluginInterfaceLookup[T]) => void {
		return (plugin: PluginInterfaceLookup[T]) => {
			this.#lookup[pluginName] = plugin;
		};
	}

	get<T extends keyof PluginInterfaceLookup>(pluginName: T): LibroccoPlugin<PluginInterfaceLookup[T]> {
		const plugin = this.#lookup[pluginName];
		const register = (plugin: PluginInterfaceLookup[T]) => {
			this.set(pluginName)(plugin);
			return Object.assign(plugin, { register });
		};
		return Object.assign(plugin, { register });
	}
}

// #region fallbacks
const bookFetcherFallback = {
	fetchBookData: async () => [],
	isAvailableStream: new BehaviorSubject(false)
};
// #endregion fallbacks

export const newPluginsInterface = () => new Plugins();
