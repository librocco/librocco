import { sveltekit } from "@sveltejs/kit/vite";
import { HstSvelte } from "@histoire/plugin-svelte";

import { searchForWorkspaceRoot } from "vite";

/** @type {import('vite').UserConfig} */
const config = {
	plugins: [sveltekit()],
	histoire: {
		plugins: [HstSvelte()],
		setupFile: "./src/histoire.setup.ts",
		storyMatch: ["src/**/*.story.svelte"],
		vite: {
			base: "/",
			server: {
				open: true,
				fs: {
					// Allow serving files from workspace root with dev server
					allow: [searchForWorkspaceRoot(process.cwd()), "../.."]
				}
			}
		}
	},
	build: {
		rollupOptions: {
			external: ["lucide-svelte"]
		}
	}
};

export default config;
