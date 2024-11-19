const path = require("path");

const { useTSConfig } = require("../../pkg/scaffold/.eslint.utils.js");
const scaffoldConfig = require("../../pkg/scaffold/.eslintrc.ui.cjs");

const tsPaths = [
    path.join(__dirname, "./tsconfig.json"),
    path.join(__dirname, "./tsconfig.service-worker.json")
];

module.exports = useTSConfig(
	{
		...scaffoldConfig,
		ignorePatterns: [...scaffoldConfig.ignorePatterns, "playwright.config.ts"],
		rules: {
			...scaffoldConfig.rules,
			"no-restricted-imports": [
				"error",
				{
					paths: [
						{
							name: "$app/navigation",
							importNames: ["goto"],
							message: "Please use `goto` from `$lib/utils/navigation` instead."
						}
					]
				}
			]
		}
	},
	tsPaths
);
