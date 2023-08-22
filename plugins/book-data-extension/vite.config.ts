import path from "path";

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
	}
};

export default config;
