import path from "path";

/** @type {import('vite').UserConfig} */
const config = {
	build: {
		lib: {
			entry: {
				"plugin/index": path.join(__dirname, "src", "plugin", "index.ts"),
				"extension/index": path.join(__dirname, "src", "extension", "index.ts")
			}
		},
		rollupOptions: {
			external: ["@librocco/db"],
			input: {
				"plugin/index": path.join(__dirname, "src", "plugin", "index.ts"),
				"extension/index": path.join(__dirname, "src", "extension", "index.ts")
			},
			output: [
				{
					dir: "dist",
					entryFileNames: "[name].js",
					format: "cjs",
					sourcemap: true
				},
				{
					dir: "dist",
					entryFileNames: "[name].es.js",
					format: "esm",
					sourcemap: true
				}
			]
		}
	},
	test: {
		globals: true,
		environment: "jsdom",
		deps: { inline: true },
		// Add @testing-library/jest-dom matchers and mock modules
		setupFiles: ["./vitest.setup.ts"]
	}
};

export default config;
