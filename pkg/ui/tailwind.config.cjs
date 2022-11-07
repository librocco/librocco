const theme = require('../scaffold/tailwind.theme');

module.exports = {
	content: ['./src/**/*.{html,js,svelte,ts}'],
	theme,
	plugins: [
		require('@tailwindcss/forms'),
		function ({ addUtilities }) {
			addUtilities({
				'.scrollbar-hide': {
					'&::--webkit-scrollbar': {
						display: 'none'
					},
					'-ms-overflow-style': 'none',
					'scrollbar-width': 'none'
				}
			});
		}
	]
};
