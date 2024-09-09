/// <reference types="vitest" />
import { defineConfig } from "vite";
import path from "path";
import tsPaths from "vite-tsconfig-paths";

const rushDir = path.join(__dirname, "..", "..", "common");

export default defineConfig({
	test: {
		includeTaskLocation: true,
		browser: {
			enabled: true,
			headless: true,
			screenshotFailures: false,
			provider: "webdriverio",
			name: "chrome"
		},
		setupFiles: ["./setupTests.cjs"]
	},
	server: {
		fs: {
			// Allow calls to central pnpm registry for the project
			// and access to other rush artifacts when runnig dev server
			allow: [rushDir]
		}
	},
	resolve: {
		alias: {
			// Alias events module to use rollup-plugin-node-polyfills as node modules (such as 'events' get externalized by vite build)
			// and we need 'events' for PouchDB to work.
			events: "rollup-plugin-node-polyfills/polyfills/events"
		}
	},
	plugins: [
		{
			enforce: "pre",
			name: "configure-response-headers",
			configureServer: (server) => {
				server.middlewares.use((_req, res, next) => {
					res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
					res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
					next();
				});
			}
		},
		tsPaths()
	],
	optimizeDeps: {
		esbuildOptions: {
			// Define global variable for node modules required for PouchDB
			define: {
				global: "globalThis"
			}
		},
		exclude: ["@sqlite.org/sqlite-wasm", "sqlocal"]
	}
});
