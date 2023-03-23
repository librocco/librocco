module.exports = {
	// root: true,
	parser: "@typescript-eslint/parser",
	extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended", "prettier"],
	plugins: ["@typescript-eslint"],
	ignorePatterns: ["*.cjs", "*.config.js", "*.setup.*", "dist/*", "build/*"],
	parserOptions: {
		sourceType: "module",
		ecmaVersion: 2020
	},
	env: {
		es2017: true,
		node: true
	},
	rules: {
		"@typescript-eslint/no-explicit-any": "off"
	}
};
