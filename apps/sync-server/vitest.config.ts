import { defineConfig } from "vitest/config";

import { getViteVendorAliasEntries, logVendorSourceMode } from "../../scripts/vendor_source_config.mjs";

logVendorSourceMode("sync-server tests");

export default defineConfig({
	resolve: {
		alias: getViteVendorAliasEntries()
	},
	test: {
		globals: true,
		environment: "node",
		include: ["src/**/*.test.ts"],
		testTimeout: 10000
	}
});
