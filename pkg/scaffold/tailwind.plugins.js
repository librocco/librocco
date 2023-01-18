module.exports = [
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
];
