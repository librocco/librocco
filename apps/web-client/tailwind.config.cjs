const theme = require("../../pkg/scaffold/tailwind.theme");
const basePlugins = require("../../pkg/scaffold/tailwind.plugins");

const plugins = [
	...basePlugins,
	function ({ addComponents }) {
		addComponents({
			// Buttons
			".button": {
				"@apply inline-flex items-center px-4 py-2 rounded-md gap-2": {}
			},
			".button-text": {
				"@apply text-sm font-medium leading-5": {}
			},
			".button-green": {
				"@apply bg-teal-500 text-green-50 active:bg-teal-400": {}
			},
			".button-white": {
				"@apply bg-white border border-gray-300 text-gray-500 active:bg-gray-50": {}
			},
			".button-alert": {
				"@apply bg-pink-50 text-pink-700 active:bg-pink-100": {}
			},

			// Lists
			".entity-list-container": {
				"@apply select-none divide-y divide-gray-300 overflow-y-auto px-6": {}
			},
			".entity-list-row": {
				"@apply flex items-center justify-between py-4 px-6": {}
			},
			".entity-list-text-lg": {
				"@apply mb-1 text-base font-semibold leading-6": {}
			},
			".entity-list-text-sm": {
				"@apply text-sm font-normal leading-5": {}
			}
		});
	}
];

module.exports = {
	content: [
		"./src/**/*.{html,js,svelte,ts}",
		// Go through other @librocco/* dependencies when
		// looking for templates
		"node_modules/@librocco/**/*.{html,js,svelte,ts}"
	],
	theme,
	plugins
};
