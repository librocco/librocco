import adapter from '@sveltejs/adapter-auto';
import preprocess from 'svelte-preprocess';

const ignorePatterns = [
	// Ignore stories files
	'.stories',
	// Ignore __tests__, __testUtils__, __testData__, etc.
	'__test*'
];

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://github.com/sveltejs/svelte-preprocess
	// for more information about preprocessors
	preprocess: preprocess(),

	kit: {
		adapter: adapter(),

		files: {
			lib: 'src'
		},
		package: {
			dir: 'dist',
			files: (fp) => ignorePatterns.every((p) => !new RegExp(p).test(fp))
		}
	}
};

export default config;
