const baseConfig = require("./.prettierrc.cjs");

module.exports = {
	...baseConfig,
	plugins: ["prettier-plugin-svelte", "prettier-plugin-tailwindcss"]
};
