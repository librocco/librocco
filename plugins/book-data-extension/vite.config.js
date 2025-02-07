import path from "path";

/** @type {import('vite').UserConfig} */
const config = {
	build: {
		lib: {
			entry: {
				"plugin/index": path.join(__dirname, "src", "plugin", "index.ts"),
				"extension/index": path.join(__dirname, "src", "extension", "index.ts"),
				"extension/background": path.join(__dirname, "src", "extension", "background.ts")
			}
		},
		rollupOptions: {
			external: ["@librocco/shared"],
			input: {
				"plugin/index": path.join(__dirname, "src", "plugin", "index.ts"),
				"extension/index": path.join(__dirname, "src", "extension", "index.ts"),
				"extension/background": path.join(__dirname, "src", "extension", "background.ts")
			},
			output: [
				{
					dir: "dist",
					entryFileNames: "[name].cjs",
					format: "cjs"
				},
				{
					dir: "dist",
					entryFileNames: "[name].es.js",
					format: "esm"
				}
			]
		},
		sourcemap: true
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
