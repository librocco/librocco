import { sveltekit } from "@sveltejs/kit/vite";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

import RollupNodePolyfill from "rollup-plugin-node-polyfills";

const rushDir = path.join(__dirname, "..", "..", "common");

/** @type {import('vite').UserConfig} */
const config = {
	plugins: [
		sveltekit(),
		VitePWA({})
		// 	{
		// 	manifest: {
		// 		icons: [{ src: "/static/android-chrome-512x512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" }]
		// 	}
		// }
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
		}
	},
	server: {
		fs: {
			// Allow calls to central pnpm registry for the project
			// and access to other rush artifacts when runnig dev server
			allow: [rushDir]
		}
	},
	build: {
		rollupOptions: {
			// This is the node modules polyfill (namely 'events') for PouchDB purposes, in production
			plugins: [
				RollupNodePolyfill({
					include: ["events"]
				})
			]
		}
	}
};

export default config;
