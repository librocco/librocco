import path from "path";
import { createReadStream } from "fs";
import { stat } from "fs/promises";
import { sveltekit } from "@sveltejs/kit/vite";
import { sentrySvelteKit } from "@sentry/sveltekit";

import pkg from "./package.json";

const rushDir = path.join(__dirname, "..", "..", "common");

export const DEFAULT_BASE_PATH = "/preview";

const dev = process.env.NODE_ENV === "development";
const CURRENT_SHA = process.env.CURRENT_SHA;

if (process.env.SENTRY_AUTH_TOKEN != "") {
	console.log("building with sentry...");
}

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
		process.env.SENTRY_AUTH_TOKEN && sentrySvelteKit(),
		sveltekit(),
		{
			name: "configure-response-headers",
			configureServer(server) {
				server.middlewares.use((req, res, next) => {
					res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
					res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
					next();
				});

				// Serve live-data/ directory at /_live-data/ for dev/debug use
				const liveDataDir = path.join(__dirname, "..", "..", "live-data");
				server.middlewares.use("/_live-data", async (req, res) => {
					const fname = (req.url || "/").replace(/^\/+/, "");
					if (!fname || fname.includes("..")) {
						res.statusCode = 403;
						res.end("Forbidden");
						return;
					}
					const fpath = path.join(liveDataDir, fname);
					try {
						const { size } = await stat(fpath);
						res.setHeader("Content-Length", size);
						res.setHeader("Content-Type", "application/octet-stream");
						createReadStream(fpath).pipe(res);
					} catch {
						res.statusCode = 404;
						res.end("Not found");
					}
				});
			}
		}
	],
	worker: {
		format: "es"
	},
	optimizeDeps: {
		esbuildOptions: {
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
