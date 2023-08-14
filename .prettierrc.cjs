module.exports = {
	printWidth: 140,
	singleQuote: false,
	useTabs: true,
	tabWidth: 2,
	trailingComma: "none",
	overrides: [
		{
			files: "*.md",
			options: {
				useTabs: false,
				quoteProps: "preserve"
			}
		},
		{
			files: ["**/CHANGELOG.md", "**/.svelte-kit/**"],
			options: {
				requirePragma: true
			}
		}
	]
};
