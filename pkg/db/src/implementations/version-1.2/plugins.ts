import { LibroccoPlugin, PluginInterfaceLookup } from "@/types";

import { BookFetcherPluginController } from "./book-fetcher-plugin";

export interface PluginsInterface {
	get<T extends keyof PluginInterfaceLookup>(pluginName: T): LibroccoPlugin<PluginInterfaceLookup[T]>;
}

class Plugins implements PluginsInterface {
	#lookup: PluginInterfaceLookup;

	constructor() {
		this.#lookup = {
			// We're using a book fetcher plugin controller to manage the book fetcher plugins
			// the book fetcher plugin controller has its own 'register' method, meaning: all book fetcher
			// plugin implementations will be registered internally and "book-fetcher" (in this lookup) will
			// always be the plugin controller (it won't get overwritten by new registrations)
			"book-fetcher": new BookFetcherPluginController()
		};
	}

	private set<T extends keyof PluginInterfaceLookup>(pluginName: T, plugin: PluginInterfaceLookup[T]): void {
		this.#lookup[pluginName] = plugin;
	}

	get<T extends keyof PluginInterfaceLookup>(pluginName: T): LibroccoPlugin<PluginInterfaceLookup[T]> {
		const plugin = this.#lookup[pluginName];
		const register = (plugin: PluginInterfaceLookup[T]) => {
			this.set(pluginName, plugin);

			// If the instance has a its own register method, we're using that one, otherwise we're assigning a default register - acitve instance will be overwitten
			return Object.hasOwn(plugin, "register") ? (plugin as LibroccoPlugin<PluginInterfaceLookup[T]>) : Object.assign(plugin, { register });
		};

		// If the instance has a its own register method, we're using that one, otherwise we're assigning a default register - acitve instance will be overwitten
		return Object.hasOwn(plugin, "register") ? (plugin as LibroccoPlugin<PluginInterfaceLookup[T]>) : Object.assign(plugin, { register });
	}
}

export const newPluginsInterface = () => new Plugins();
