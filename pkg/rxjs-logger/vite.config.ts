import { defineConfig } from "vite";
import path from "path";

export default defineConfig({
	build: {
		lib: {
			name: "@librocco/db",
			entry: path.join(__dirname, "src", "index.ts"),
			fileName: (fmt) => (fmt === "es" ? "index.es.js" : "index.js"),
			formats: ["es", "cjs"]
		},
		rollupOptions: {
			external: ["rxjs"],
			output: {
				exports: "named"
			}
		},
		outDir: "dist"
	}
});
