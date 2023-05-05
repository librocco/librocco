import adapter from "@sveltejs/adapter-static";
import preprocess from "svelte-preprocess";

export const DEFAULT_BASE_PATH = "/preview";

const dev = process.env.NODE_ENV === "development";
const CURRENT_SHA = process.env.CURRENT_SHA;
let BASE_PATH = process.env.BASE_PATH;

if (typeof BASE_PATH === "undefined") {
	// If no BASE_PATH was passed as environment variable, we default to either
	// `/preview` or (if CURRENT_SHA is defined) to `/preview/<CURRENT_SHA>`
	BASE_PATH = dev || !CURRENT_SHA ? DEFAULT_BASE_PATH : `${DEFAULT_BASE_PATH}/${CURRENT_SHA}`;
}

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://github.com/sveltejs/svelte-preprocess
	// for more information about preprocessors
	preprocess: preprocess(),

	kit: {
		adapter: adapter(),
		prerender: {
			entries: [
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
