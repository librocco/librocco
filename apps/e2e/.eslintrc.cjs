const path = require("path");

const { useTSConfig } = require("../../pkg/scaffold/.eslint.utils.js");
const scaffoldConfig = require("../../pkg/scaffold/.eslintrc.cjs");

const tsPaths = [path.join(__dirname, "./tsconfig.json")];

module.exports = useTSConfig(
	{
		...scaffoldConfig,
		ignorePatterns: [...scaffoldConfig.ignorePatterns, "playwright.config.ts", "test-results/*", "playwright-report/*"]
	},
	tsPaths
);
