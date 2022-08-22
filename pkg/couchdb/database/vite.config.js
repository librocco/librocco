import { defineConfig } from "vite";
import path from "path";

export default defineConfig({
  build: {
    lib: {
      name: "@librocco/shared",
      entry: path.join(__dirname, "src", "index.ts"),
      fileName: (fmt) => (fmt === "es" ? "index.es.js" : "index.js"),
      formats: ["es", "cjs"],
    },
    rollupOptions: {
      external: ["react"],
      output: {
        exports: "named",
      },
    },
    outDir: "dist",
  },
});
