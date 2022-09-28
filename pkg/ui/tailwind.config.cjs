const theme = require('../scaffold/tailwind.theme');

module.exports = {
	content: ['./src/**/*.{html,js,svelte,ts}'],
	theme,
	plugins: [require('@tailwindcss/forms')]
};
