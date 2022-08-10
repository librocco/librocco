import { UserConfig } from 'vite';

import { svelte as sveltekit } from '@sveltejs/kit/dist/vite';

const config: UserConfig = {
	plugins: [sveltekit()]
};

export default config;
