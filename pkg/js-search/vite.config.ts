import path from "path";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    sourcemap: true,
    lib: {
      entry: path.resolve(__dirname, "source/index.ts"),
      name: "js-search",
      fileName: (format) => `js-search.${format}.js`,
    },
  },
});
