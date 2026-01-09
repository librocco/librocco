import path from "path";
import { svelte } from "@sveltejs/vite-plugin-svelte";

import { defineConfig } from "vitest/config";

import { USE_SUBMODULES } from "./build_constants";

/**
 * A helper used to provide aliases for vlcn.io packages in dev mode:
 * - if in local test mode, we're aliasing vlcn.io imports to submoduled packages (under '3rd-party/js')
 * - if in CI, no aliases are provided: installed dependencies built from tarballs ('3rd-party/artefacts') are used
 */
function alias_vlcn_dev() {
	console.log("\n");

	if (!USE_SUBMODULES) {
		console.log("testing using vlcn.io packages installed from '3rd-party/artefacts'");
		console.log("\n");
		return {};
	}

	const aliases = {
		"@vlcn.io/crsqlite": path.resolve(__dirname, "../../3rd-party/js/deps/cr-sqlite/core/nodejs-helper.js"),
		"@vlcn.io/crsqlite-wasm": path.resolve(__dirname, "../../3rd-party/js/packages/crsqlite-wasm/dist"),
		"@vlcn.io/rx-tbl": path.resolve(__dirname, "../../3rd-party/js/packages/rx-tbl/dist"),
		"@vlcn.io/wa-sqlite": path.resolve(__dirname, "../../3rd-party/js/deps/wa-sqlite"),
		"@vlcn.io/ws-browserdb": path.resolve(__dirname, "../../3rd-party/js/packages/ws-browserdb/dist"),
		"@vlcn.io/ws-client/worker.js": path.resolve(__dirname, "../../3rd-party/js/packages/ws-client/dist/worker/worker.js"),
		"@vlcn.io/ws-client": path.resolve(__dirname, "../../3rd-party/js/packages/ws-client/dist"),
		"@vlcn.io/ws-common": path.resolve(__dirname, "../../3rd-party/js/packages/ws-common/dist"),
		"@vlcn.io/ws-server": path.resolve(__dirname, "../../3rd-party/js/packages/ws-server/dist"),
		"@vlcn.io/xplat-api": path.resolve(__dirname, "../../3rd-party/js/packages/xplat-api/dist/xplat-api.js")
	};

	console.log("submodule test: aliasing vlcn.io packages to respective submodules:");
	for (const [pkg, path] of Object.entries(aliases)) {
		console.log(`  ${pkg} -> ${path}`);
	}
	console.log("\n");

	return aliases;
}

export default defineConfig({
	plugins: [svelte({ hot: !process.env.VITEST })],
	publicDir: "static",

	resolve: {
		alias: {
			$lib: path.resolve(__dirname, "src/lib"),

			// (conditionally) alias the vlcn-io submodules
			...alias_vlcn_dev(),

			// some mocks used to not break the tests while testing components using them
			$lucide: path.resolve(__dirname, "node_modules/lucide-svelte/dist/icons"),

			// sveltekit module mocks for test environment
			//
			// NOTE: these defaults shouldn't be terribly relevant for testing usage,
			// but do check them out in case some tested functionality DOES depend on correct values
			"$app/paths": path.resolve(__dirname, "src/__mocks__/$app-paths.ts"),
			"$app/navigation": path.resolve(__dirname, "src/__mocks__/$app-navigation.ts"),
			"$app/stores": path.resolve(__dirname, "src/__mocks__/$app-stores.ts"),
			"$app/environment": path.resolve(__dirname, "src/__mocks__/$app-environment.ts"),
			"$app/forms": path.resolve(__dirname, "src/__mocks__/$app-forms.ts"),
			"$env/static/public": path.resolve(__dirname, "src/__mocks__/$env-static-public.ts"),
			"$env/dynamic/public": path.resolve(__dirname, "src/__mocks__/$env-dynamic-public.ts")
		}
	},

	optimizeDeps: {
		exclude: ["sveltekit-superforms"],
		esbuildOptions: {
			alias: {
				"$app/paths": path.resolve(__dirname, "src/__mocks__/$app-paths.ts"),
				"$app/navigation": path.resolve(__dirname, "src/__mocks__/$app-navigation.ts"),
				"$app/stores": path.resolve(__dirname, "src/__mocks__/$app-stores.ts"),
				"$app/environment": path.resolve(__dirname, "src/__mocks__/$app-environment.ts"),
				"$app/forms": path.resolve(__dirname, "src/__mocks__/$app-forms.ts"),
				"$env/static/public": path.resolve(__dirname, "src/__mocks__/$env-static-public.ts"),
				"$env/dynamic/public": path.resolve(__dirname, "src/__mocks__/$env-dynamic-public.ts")
			}
		}
	},

	test: {
		include: ["src/**/*.{test,spec}.{js,ts}"],
		browser: {
			enabled: true,
			provider: "playwright",
			instances: [{ browser: "chromium" }]
		}
	},

	server: {
		hmr: {
			// Force the HMR websocket to use the same protocol as the page
			protocol: "ws",
			// Use the browser's location for the HMR websocket
			host: "localhost",
			port: 5173
		}
	}
});
