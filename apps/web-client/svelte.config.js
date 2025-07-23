import adapter from "@sveltejs/adapter-static";
import preprocess from "svelte-preprocess";

import { preprocessMeltUI } from "@melt-ui/pp";
import sequence from "svelte-sequential-preprocessor";

const BASE_PATH = process.env.BASE_PATH ?? "";
const USE_SUBMODULES = process.env.USE_SUBMODULES === "true";

/**
 * A helper used to provide aliases for vlcn.io packages in dev mode:
 * - if in dev mode, we're aliasing vlcn.io imports to submoduled packages (under '3rd-party/js')
 * - if in production mode, no aliases are provided: installed dependencies built from tarballs ('3rd-party/artefacts') are used
 */
function alias_vlcn_dev() {
	console.log("\n");

	if (!USE_SUBMODULES) {
		console.log("using vlcn.io packages installed from '3rd-party/artefacts'");
		console.log("\n");
		return {};
	}

	const aliases = {
		"@vlcn.io/crsqlite": "../../3rd-party/js/deps/cr-sqlite/core/nodejs-helper.js",
		"@vlcn.io/crsqlite-wasm": "../../3rd-party/js/packages/crsqlite-wasm/dist",
		"@vlcn.io/rx-tbl": "../../3rd-party/js/packages/rx-tbl/dist",
		"@vlcn.io/wa-sqlite": "../../3rd-party/js/deps/wa-sqlite",
		"@vlcn.io/ws-browserdb": "../../3rd-party/js/packages/ws-browserdb/dist",
		"@vlcn.io/ws-client/worker.js": "../../3rd-party/js/packages/ws-client/dist/worker/worker.js",
		"@vlcn.io/ws-client": "../../3rd-party/js/packages/ws-client/dist",
		"@vlcn.io/ws-common": "../../3rd-party/js/packages/ws-common/dist",
		"@vlcn.io/ws-server": "../../3rd-party/js/packages/ws-server/dist"
	};

	console.log("using submodules: aliasing vlcn.io packages to respective submodules:");
	for (const [pkg, path] of Object.entries(aliases)) {
		console.log(`  ${pkg} -> ${path}`);
	}
	console.log("all changes made to these files will be reflected in the dev server");
	console.log("\n");

	return aliases;
}

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://github.com/sveltejs/svelte-preprocess
	// for more information about preprocessors
	preprocess: sequence([preprocess(), preprocessMeltUI()]),
	kit: {
		alias: {
			$lucide: "node_modules/lucide-svelte/dist/icons",
			"$i18n/*": "./src/i18n/*",
			...alias_vlcn_dev()
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
