import { sveltekit } from "@sveltejs/kit/vite";
import { SvelteKitPWA } from "@vite-pwa/sveltekit";
import path from "path";
import RollupNodePolyfill from "rollup-plugin-node-polyfills";

const rushDir = path.join(__dirname, "..", "..", "common");

/** @type {import('vite').UserConfig} */
const config = {
	plugins: [
		sveltekit(),
		SvelteKitPWA({
			// outDir: "build",
			buildBase: "/preview/",
			kit: {
				trailingSlash: "always"
			},
			// strategies: "generateSW",
			workbox: {
				// Only precache these files - html should be excluded
				globPatterns: ["**/*.{js,css}"],

				// Don't fallback on document based (e.g. `/some-page`) requests
				// Even though this says `null` by default, I had to set this specifically to `null` to make it work
				navigateFallback: null
			}
			// manifest: {
			// 	icons: [{ src: "/static/android-chrome-512x512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" }]
			// }
		})
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
