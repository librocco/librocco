import { defineConfig, mergeConfig } from "vitest/config";

import { browserBackedTests, createSharedVitestConfig } from "./vitest.shared";

export default mergeConfig(
	createSharedVitestConfig(),
	defineConfig({
		test: {
			name: "unit",
			environment: "jsdom",
			include: ["src/**/*.{test,spec}.{js,ts}"],
			exclude: ["src/**/*.stories.@(js|jsx|ts|tsx|svelte)", ...browserBackedTests]
		}
	})
);
