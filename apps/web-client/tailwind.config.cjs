const theme = require("../../pkg/scaffold/tailwind.theme");
const basePlugins = require("../../pkg/scaffold/tailwind.plugins");

const plugins = [
	...basePlugins,
	function ({ addComponents }) {
		addComponents({
			// Buttons
			".button": {
				"@apply inline-flex items-center px-4 py-2 rounded-md gap-2 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 focus:ring-offset-white":
					{}
			},
			".button-text": {
				"@apply text-sm font-medium leading-5": {}
			},
			".button-red": {
				"@apply bg-red-600 text-white active:bg-red-400 hover:bg-red-200": {}
			},
			".button-green": {
				"@apply bg-teal-500 text-green-50 active:bg-teal-400 hover:bg-teal-700": {}
			},
			".button-white": {
				"@apply bg-white border border-gray-300 text-gray-500 active:bg-gray-50 hover:bg-gray-50": {}
			},
			".button-alert": {
				"@apply bg-pink-50 text-pink-700 active:bg-pink-100 hover:bg-pink-100": {}
			},

			// Badge
			".badge": {
				"@apply inline-flex items-center rounded": {}
			},
			".badge-base": {
				"@apply px-2.5 py-0.5 text-xs": {}
			},
			".badge-lg": {
				"@apply px-3 py-0.5 text-sm": {}
			},
			".badge-neutral": {
				"@apply bg-gray-100 text-gray-800": {}
			},
			".badge-error": {
				"@apply bg-red-100 px-2.5 text-red-800": {}
			},
			".badge-warning": {
				"@apply bg-yellow-100 text-yellow-800": {}
			},
			".badge-success": {
				"@apply bg-teal-100 text-teal-800": {}
			},

			// Lists
			".entity-list-container": {
				"@apply h-full w-full select-none divide-y divide-gray-300 overflow-y-auto px-6": {}
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
