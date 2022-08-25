import { sveltekit } from '@sveltejs/kit/vite';
import path from 'path';

const rushDir = path.join(__dirname, '..', '..', 'common');

/** @type {import('vite').UserConfig} */
const config = {
	plugins: [sveltekit()],
	server: {
		fs: {
			// Allow calls to central pnpm registry for the project
			// and access to other rush artifacts when runnig dev server
			allow: [rushDir]
		}
	}
};

export default config;
