module.exports = {
	webpackFinal: async (config) => {
		const svelteLoader = config.module.rules.find(
			(r) => r.loader && r.loader.includes('svelte-loader')
		);
		svelteLoader.options.preprocess = require('svelte-preprocess')({});
		return config;
	},
	stories: ['../src/**/*.stories.mdx', '../src/**/*.stories.svelte'],
	addons: [
		{
			name: '@storybook/addon-postcss',
			options: {
				postcssLoaderOptions: {
					// When using postCSS 8
					implementation: require('postcss')
				}
			}
		},
		'@storybook/addon-links',
		'@storybook/addon-essentials',
		'@storybook/addon-svelte-csf'
	],
	framework: '@storybook/svelte',
	svelteOptions: {
		preprocess: import('../svelte.config.js').then((module) => module.default.preprocess)
	}
};
