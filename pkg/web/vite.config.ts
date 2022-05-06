import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import environmentPlugin from "vite-plugin-environment";
import svgr from "vite-plugin-svgr";
import path from "path";

const svgrOptions = require("../scaffold/svgrOptions");

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  build: {
    sourcemap: true,
  },
  plugins: [
    react(),
    environmentPlugin({
      /** Your whitelisted .env variables here */
    }),
    svgr({
      exportAsDefault: true,
      svgrOptions,
    }),
  ],
});
