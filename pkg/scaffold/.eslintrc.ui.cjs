const baseConfig = require("./.eslintrc.cjs");

module.exports = {
	...baseConfig,
	plugins: [...baseConfig.plugins, "svelte3"],
	overrides: [
		...(baseConfig.overrides || []),
		{
			files: ["*.svelte"],
			processor: "svelte3/svelte3",
		},
	],
	settings: {
		...baseConfig.settings,
		"svelte3/typescript": () => require("typescript"),
	},
	env: {
		...baseConfig.env,
		browser: true,
	},
};
