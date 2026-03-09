import { defineConfig, defineWorkspace, mergeConfig } from "vitest/config";

import { browserBackedTests, createSharedVitestConfig } from "./vitest.shared";

export default defineWorkspace([
	"./vitest.config.ts",
	mergeConfig(
		createSharedVitestConfig(),
		defineConfig({
			test: {
				name: "browser-backed",
				include: browserBackedTests,
				browser: {
					enabled: true,
					provider: "playwright",
					headless: true,
					instances: [{ browser: "chromium" }]
				}
			}
		})
	)
]);
