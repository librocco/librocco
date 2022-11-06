const theme = require('../scaffold/tailwind.theme');
const plugins = require('../scaffold/tailwind.plugins');

module.exports = {
	content: ['./src/**/*.{html,js,svelte,ts}'],
	theme,
	plugins
};
