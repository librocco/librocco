import path from "path";
import { sveltekit } from "@sveltejs/kit/vite";
import { sentrySvelteKit } from "@sentry/sveltekit";

import pkg from "./package.json";

const rushDir = path.join(__dirname, "..", "..", "common");

export const DEFAULT_BASE_PATH = "/preview";

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
		sentrySvelteKit(),
		sveltekit(),
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
		sourcemap: true
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
