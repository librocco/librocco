/// <reference types="vitest" />
import { defineConfig } from "vite";

export default defineConfig({
	test: {
		globals: true,
		environment: "jsdom",
		deps: { inline: true },
		// Add @testing-library/jest-dom matchers and mock modules
		setupFiles: ["./vitest.setup.ts"]
	}
});
