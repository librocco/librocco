const baseConfig = require("./.eslintrc.cjs");

module.exports = {
	...baseConfig,
	plugins: [...baseConfig.plugins],
	overrides: [
		...(baseConfig.overrides || []),
		{
			files: ["*.svelte"],
			parser: "svelte-eslint-parser",
			// Parse the `<script>` in `.svelte` as TypeScript by adding the following configuration.
			parserOptions: {
				parser: "@typescript-eslint/parser",
				// This might not be the smartest move, but I couldn't find a straight answer as to why
				// we are getting these warnings: open and closed discussions on the topic are very convoluted
				// It seems to work without issue... but keep an eye on it
				warnOnUnsupportedTypeScriptVersion: false
			},
			rules: {
				"no-unsafe-optional-chaining": "off",
				"no-inner-declarations": "off",
				"no-import-assign": "off",
				"@typescript-eslint/no-unused-vars": "off",
				"@typescript-eslint/no-empty-function": "off",
				"@typescript-eslint/no-inferrable-types": "off",
				"@typescript-eslint/no-non-null-assertion": "off",
				"@typescript-eslint/no-non-null-asserted-optional-chain": "off"
			}
		}
	],
	settings: {
		...baseConfig.settings
	},
	env: {
		...baseConfig.env,
		browser: true
	}
};
