/// <reference types="vitest" />
import { defineConfig } from "vite";
import path from "path";
import tsPaths from "vite-tsconfig-paths";

export default defineConfig({
	resolve: {
		alias: {
			// Alias events module to use rollup-plugin-node-polyfills as node modules (such as 'events' get externalized by vite build)
			// and we need 'events' for PouchDB to work.
			events: "rollup-plugin-node-polyfills/polyfills/events"
		}
	},
	plugins: [tsPaths()],
	optimizeDeps: {
		esbuildOptions: {
			// Define global variable for node modules required for PouchDB
			define: {
				global: "globalThis"
			}
		},
		exclude: ["@sqlite.org/sqlite-wasm", "sqlocal"]
	},
	build: {
		sourcemap: true,
		assetsDir: "assets",
		lib: {
			name: "@librocco/db",
			entry: path.join(__dirname, "src", "index.ts"),
			fileName: (fmt) => (fmt === "es" ? "index.es.js" : "index.js"),
			formats: ["es", "cjs"]
		},
		rollupOptions: {
			external: ["svelte", "rxjs", "pouchdb", "crstore", "kysely", "sqlocal", "sqlocal/kysely"],
			output: {
				exports: "named",
				assetFileNames: "[name][extname]"
			}
		},
		outDir: "dist"
	}
});
