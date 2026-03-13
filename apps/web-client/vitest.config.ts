import path from "path";
import { svelte } from "@sveltejs/vite-plugin-svelte";

import { defineConfig } from "vitest/config";

import { getViteVendorAliasEntries, logVendorSourceMode } from "../../scripts/vendor_source_config.mjs";

function alias_vlcn_dev() {
	logVendorSourceMode("web-client tests");
	const aliases = getViteVendorAliasEntries();
	return aliases;
}

export default defineConfig({
	plugins: [svelte({ hot: !process.env.VITEST })],
	publicDir: "static",

	resolve: {
		alias: [
			{ find: "$lib", replacement: path.resolve(__dirname, "src/lib") },

			// (conditionally) alias local vlcn sources
			...alias_vlcn_dev(),

			// some mocks used to not break the tests while testing components using them
			{ find: "$lucide", replacement: path.resolve(__dirname, "node_modules/lucide-svelte/dist/icons") },

			// sveltekit module mocks for test environment
			//
			// NOTE: these defaults shouldn't be terribly relevant for testing usage,
			// but do check them out in case some tested functionality DOES depend on correct values
			{ find: "$app/paths", replacement: path.resolve(__dirname, "src/__mocks__/$app-paths.ts") },
			{ find: "$app/navigation", replacement: path.resolve(__dirname, "src/__mocks__/$app-navigation.ts") },
			{ find: "$app/stores", replacement: path.resolve(__dirname, "src/__mocks__/$app-stores.ts") },
			{ find: "$app/environment", replacement: path.resolve(__dirname, "src/__mocks__/$app-environment.ts") },
			{ find: "$app/forms", replacement: path.resolve(__dirname, "src/__mocks__/$app-forms.ts") },
			{ find: "$env/static/public", replacement: path.resolve(__dirname, "src/__mocks__/$env-static-public.ts") },
			{ find: "$env/dynamic/public", replacement: path.resolve(__dirname, "src/__mocks__/$env-dynamic-public.ts") }
		]
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
