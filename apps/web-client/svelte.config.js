import adapter from "@sveltejs/adapter-static";
import preprocess from "svelte-preprocess";

import { preprocessMeltUI } from "@melt-ui/pp";
import sequence from "svelte-sequential-preprocessor";

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://github.com/sveltejs/svelte-preprocess
	// for more information about preprocessors
	preprocess: sequence([preprocess(), preprocessMeltUI()]),
	kit: {
		serviceWorker: {
			register: false
		},
		adapter: adapter(),
		prerender: {
			entries: [
				// TODO: update once rehaul is finished
				"/proto/inventory/inbound/",
				"/proto/inventory/inbound/1/",
				"/proto/inventory/warehouses/",
				"/proto/inventory/warehouses/1/",
				"/proto/stock/",
				"/proto/outbound/",
				"/proto/outbound/1/",
				"/proto/settings/",
				"/",
				"/inventory",
				"/inventory/",
				"/inventory/stock",
				"/inventory/stock/",
				"/inventory/inbound/",
				"/inventory/outbound/",
				"/debug"
			]
		},
		paths: {
			base: process.env.BASE_PATH,
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
