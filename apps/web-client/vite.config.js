import path from "path";
import { searchForWorkspaceRoot } from "vite";
import { sveltekit } from "@sveltejs/kit/vite";
import { SvelteKitPWA } from "@vite-pwa/sveltekit";

import RollupNodePolyfill from "rollup-plugin-node-polyfills";

import pkg from "./package.json";

const rushDir = path.join(__dirname, "..", "..", "common");

export const DEFAULT_BASE_PATH = "/preview";

// base path logic is written here because it needs to be communicated to both
// the svelteKitPWA plugin and svelte.config
const dev = process.env.NODE_ENV === "development";
const CURRENT_SHA = process.env.CURRENT_SHA;
let BASE_PATH = process.env.BASE_PATH;

if (typeof BASE_PATH === "undefined") {
	// If no BASE_PATH was passed as environment variable, we default to either
	// `/preview` or (if CURRENT_SHA is defined) to `/preview/<CURRENT_SHA>`
	BASE_PATH = dev || !CURRENT_SHA ? DEFAULT_BASE_PATH : `${DEFAULT_BASE_PATH}/${CURRENT_SHA}`;
	process.env.BASE_PATH = BASE_PATH;
}

/** @type {import('vite').UserConfig} */
const config = {
	define: {
		"import.meta.env.VITE_PKG_VERSION": `"${pkg.version}"`
	},
	plugins: [
		sveltekit(),
		SvelteKitPWA({
			buildBase: `${BASE_PATH}/`,
			kit: {
				trailingSlash: "always"
			},
			manifest: {
				name: "Librocco",
				short_name: "Librocco",
				icons: [
					{
						src: "android-chrome-192x192.png",
						sizes: "192x192",
						type: "image/png"
					},
					{
						src: "android-chrome-512x512.png",
						sizes: "512x512",
						type: "image/png"
					}
				],
				theme_color: "#ffffff",
				background_color: "#ffffff",
				display: "standalone",
				start_url: `${BASE_PATH}/inventory/stock/0-all`,
				scope: `${BASE_PATH}/`
			}
		}),
		{
			name: "configure-response-headers",
			configureServer(server) {
				server.middlewares.use((req, res, next) => {
					res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
					res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
					next();
				});
			}
		}
	],
	resolve: {
		alias: {
			// Alias events module to use rollup-plugin-node-polyfills as node modules (such as 'events' get externalized by vite build)
			// and we need 'events' for PouchDB to work.
			events: "rollup-plugin-node-polyfills/polyfills/events"
		}
	},
	optimizeDeps: {
		esbuildOptions: {
			// Define global variable for node modules required for PouchDB
			define: {
				global: "globalThis"
			}
		},
		exclude: ["sqlocal"]
	},
	server: {
		fs: {
			// Allow calls to central pnpm registry for the project
			// and access to other rush artifacts when runnig dev server
			allow: [rushDir]
		}
	},
	build: {
		sourcemap: true,
		rollupOptions: {
			// This is the node modules polyfill (namely 'events') for PouchDB purposes, in production
			plugins: [
				RollupNodePolyfill({
					include: ["events"]
				})
			]
		}
	},
	test: {
		include: ["./src/**/*.(test|spec).ts"],
		globals: true,
		environment: "jsdom",
		// deps: { inline: true },
		// Add @testing-library/jest-dom matchers and mock modules
		setupFiles: ["./src/vitest.setup.ts"]
	}
	// TODO: Uncomment this when we figure out how to make it work
	// preview: {
	// 	port: 4173,
	// 	headers: {
	// 		"Cross-Origin-Embedder-Policy": "require-corp",
	// 		"Cross-Origin-Opener-Policy": "same-origin"
	// 	}
	// }
};

export default config;
