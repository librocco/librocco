import { defineConfig } from "vite";
import path from "path";
import RollupNodePolyfill from "rollup-plugin-node-polyfills";

export default defineConfig({
	resolve: {
		alias: {
			// Alias events module to use rollup-plugin-node-polyfills as node modules (such as 'events' get externalized by vite build)
			// and we need 'events' for PouchDB to work.
			events: "rollup-plugin-node-polyfills/polyfills/events"
		}
	},
	build: {
		lib: {
			name: "@librocco/receipt-printer",
			entry: path.join(__dirname, "src", "index.ts"),
			fileName: (fmt) => (fmt === "es" ? "index.es.js" : "index.js"),
			formats: ["es", "cjs"]
		},
		rollupOptions: {
			// This is the node modules polyfill (namely 'events') for PouchDB purposes, in production
			plugins: [
				RollupNodePolyfill({
					include: ["events"]
				}) as any
			],
			output: {
				exports: "named"
			}
		},
		outDir: "dist"
	}
});
