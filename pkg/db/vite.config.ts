import { defineConfig } from "vite";
import path from "path";
import tsPaths from "vite-tsconfig-paths";

export default defineConfig({
	plugins: [tsPaths()],
	build: {
		sourcemap: true,
		lib: {
			name: "@librocco/db",
			entry: path.join(__dirname, "src", "index.ts"),
			fileName: (fmt) => (fmt === "es" ? "index.es.js" : "index.js"),
			formats: ["es", "cjs"]
		},
		rollupOptions: {
			external: ["svelte", "rxjs", "pouchdb", "crstore", "kysely", "sqlocal", "sqlocal/kysely"],
			output: {
				exports: "named"
			}
		},
		outDir: "dist"
	}
});
