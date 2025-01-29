import path from "path";

/** @type {import('vite').UserConfig} */
const config = {
	build: {
		sourcemap: true,
		lib: {
			name: "@librocco/google-books-api-plugin",
			entry: path.join(__dirname, "src", "index.ts"),
			fileName: (fmt) => (fmt === "es" ? "index.es.js" : "index.js"),
			formats: ["es", "cjs"]
		},
		rollupOptions: {
			external: ["@librocco/shared"],
			output: {
				exports: "named"
			}
		},
		outDir: "dist"
	}
};

export default config;
