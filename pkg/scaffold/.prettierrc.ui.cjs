const baseConfig = require('./.prettierrc.cjs');

module.exports = {
	...baseConfig,
	// No need for svelte plugin as 'prettier-plugin-tailwindcss' comes with svelte plugin bundled in.
	plugins: [require('prettier-plugin-tailwindcss')]
};
