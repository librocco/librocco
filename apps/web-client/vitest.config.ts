import path from "path";
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
	test: {
		include: [
			"src/lib/db/cr-sqlite/__tests__/**/*.{test,spec}.{js,ts}",
			"src/lib/db/__tests__/**/*.{test,spec}.{js,ts}",
			"src/lib/utils/__tests__/**/*.{test,spec}.{js,ts}",
			"src/lib/__tests__/**/*.{test,spec}.{js,ts}"
		],
		browser: {
			enabled: true,
			provider: "playwright",
			name: "chromium"
		},
		alias: {
			$lib: path.resolve(__dirname, "src/lib"),
			...alias_vlcn_dev()
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
