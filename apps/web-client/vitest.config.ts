import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		include: ["src/lib/db/cr-sqlite/__tests__/**/*.{test,spec}.{js,ts}", "src/lib/db/__tests__/**/*.{test,spec}.{js,ts}"],
		browser: {
			enabled: true,
			provider: "playwright",
			name: "chromium"
		},
		alias: {
			$lib: path.resolve(__dirname, "src/lib")
		}
	}
});
