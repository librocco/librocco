import { sveltekit } from '@sveltejs/kit/vite';
import { HstSvelte } from '@histoire/plugin-svelte';

/** @type {import('vite').UserConfig} */
const config = {
	plugins: [sveltekit()],
	histoire: {
		plugins: [HstSvelte()],
		setupFile: './src/histoire.setup.ts',
		vite: {
			base: '/',
			server: {
				open: true
			}
		}
	},
	build: {
		rollupOptions: {
			external: ['lucide-svelte']
		}
	}
};

export default config;
