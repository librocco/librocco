import path from "node:path";
import { fileURLToPath } from "node:url";

import { sveltekit } from "@sveltejs/kit/vite";
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import { defineConfig } from "vitest/config";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const rushDir = path.join(dirname, "..", "..", "common");
const storybookPlugins = await storybookTest({
	configDir: path.join(dirname, ".storybook"),
	storybookScript: "rushx story:dev --ci --no-open",
	tags: {
		include: ["test"],
		exclude: [],
		skip: ["skip-test"]
	}
});

export default defineConfig({
	plugins: [sveltekit()],
	publicDir: "static",
	resolve: {
		alias: {
			$lib: path.resolve(dirname, "src/lib")
		}
	},
	optimizeDeps: {
		exclude: ["sveltekit-superforms"]
	},
	server: {
		fs: {
			allow: [rushDir]
		}
	},
	test: {
		projects: [
			{
				extends: true,
				plugins: [...storybookPlugins],
				test: {
					name: "storybook",
					browser: {
						enabled: true,
						provider: "playwright",
						headless: true,
						instances: [{ browser: "chromium" }]
					},
					setupFiles: ["./.storybook/vitest.setup.ts"]
				}
			}
		]
	}
});
