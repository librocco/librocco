import { defineConfig } from "vite";
import path from "path";

export default defineConfig({
	resolve: {
		alias: {
			"@": path.join(__dirname, "src"),
			"@test-runner": path.join(__dirname, "src", "test-runner"),
			"@data-loaders": path.join(__dirname, "src", "data-loaders"),
			"@unit-test-data": path.join(__dirname, "src", "test-runner", "__testData__")
		}
	},
	build: {
		sourcemap: true,
		lib: {
			name: "@librocco/db",
			entry: path.join(__dirname, "src", "index.ts"),
			fileName: (fmt) => (fmt === "es" ? "index.es.js" : "index.js"),
			formats: ["es", "cjs"]
		},
		rollupOptions: {
			external: ["rxjs, pouchdb"],
			output: {
				exports: "named"
			}
		},
		outDir: "dist"
	}
});
