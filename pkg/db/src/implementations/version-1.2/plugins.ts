import { LibroccoPlugin, PluginInterfaceLookup } from "@/types";

import { BookFetcherPluginController } from "./book-fetcher-plugin";

export interface PluginsInterface {
	get<T extends keyof PluginInterfaceLookup>(pluginName: T): LibroccoPlugin<PluginInterfaceLookup[T]>;
}

class Plugins implements PluginsInterface {
	#lookup: PluginInterfaceLookup;

	constructor() {
		this.#lookup = createDefaultPluginInstances();
	}

	private set<T extends keyof PluginInterfaceLookup>(pluginName: T, plugin: PluginInterfaceLookup[T]): void {
		this.#lookup[pluginName] = plugin;
	}

	get<T extends keyof PluginInterfaceLookup>(pluginName: T): LibroccoPlugin<PluginInterfaceLookup[T]> {
		const plugin = this.#lookup[pluginName];

		// Reset the plugin to its default state
		const reset = () => {
			this.#lookup = createDefaultPluginInstances();
		};

		const register = (plugin: PluginInterfaceLookup[T]): LibroccoPlugin<PluginInterfaceLookup[T]> => {
			this.set(pluginName, plugin);

			return wrapLibroccoPlugin(plugin, { register, reset });
		};

		return wrapLibroccoPlugin(plugin, { register, reset });
	}
}

export const newPluginsInterface = () => new Plugins();

const createDefaultPluginInstances = (): PluginInterfaceLookup => ({
	// We're using a book fetcher plugin controller to manage the book fetcher plugins
	// the book fetcher plugin controller has its own 'register' method, meaning: all book fetcher
	// plugin implementations will be registered internally and "book-fetcher" (in this lookup) will
	// always be the plugin controller (it won't get overwritten by new registrations)
	"book-fetcher": new BookFetcherPluginController()
});

const wrapLibroccoPlugin = <P extends PluginInterfaceLookup[keyof PluginInterfaceLookup]>(
	plugin: P,
	{ register, reset }: { register: (plugin: P) => LibroccoPlugin<P>; reset: () => void }
): LibroccoPlugin<P> => {
	// The plugin instance might aleady have (one or more) librocco plugin methods, in that case prefer the plugin's methods
	const additionalMethods = {
		register: Object.hasOwn(plugin, "register") ? (plugin as LibroccoPlugin<any>).register : register,
		reset: Object.hasOwn(plugin, "register") ? (plugin as LibroccoPlugin<any>).reset : reset
	};
	return Object.assign(plugin, additionalMethods);
};
