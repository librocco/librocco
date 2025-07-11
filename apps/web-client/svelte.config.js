import adapter from "@sveltejs/adapter-static";
import preprocess from "svelte-preprocess";

import { preprocessMeltUI } from "@melt-ui/pp";
import sequence from "svelte-sequential-preprocessor";

const BASE_PATH = process.env.BASE_PATH ?? "";

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://github.com/sveltejs/svelte-preprocess
	// for more information about preprocessors
	preprocess: sequence([preprocess(), preprocessMeltUI()]),
	kit: {
		alias: {
			"$i18n/*": "./src/i18n/*",
			$lucide: "node_modules/lucide-svelte/dist/icons"
		},
		serviceWorker: {
			register: false
		},
		adapter: adapter(),
		router: {
			type: "hash"
		},
		prerender: {
			// Note: the '...path/1/' is a workaround for prebuilding the skeleton for all
			// pages that will, in the browser have a param (in place of the 1), used to render dynamic data.
			entries: [
				"/",
				"/debug",
				"/inventory",
				"/inventory/",
				"/inventory/inbound/",
				"/inventory/inbound/1/",
				"/inventory/warehouses/",
				"/inventory/warehouses/1/",
				"/stock/",
				"/outbound/",
				"/outbound/1/",
				"/orders/customers/",
				"/orders/customers/1/",
				"/orders/suppliers/",
				"/orders/suppliers/1/",
				"/orders/suppliers/1/new-order/",
				"/orders/suppliers/orders/",
				"/orders/suppliers/orders/1/",
				"/orders/suppliers/reconcile/1/",
				"/orders/suppliers/1/",
				"/history/date/1/",
				"/history/isbn/",
				"/history/isbn/1/",
				"/history/notes/archive/1/",
				"/history/notes/1/",
				"/history/warehouse/1",
				"/history/warehouse/1/1",
				"/history/warehouse/1/1/1/",
				"/outbound/1/",
				"/settings/"
			]
		},
		paths: {
			base: BASE_PATH,
			relative: false
		},
		typescript: {
			config: (config) => ({
				...config,
				compilerOptions: {
					...config.compilerOptions,
					resolveJsonModule: true,
					allowSyntheticDefaultImports: true
				}
			})
		}
	}
};

export default config;
