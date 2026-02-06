import type { StorybookConfig } from "@storybook/sveltekit";

const config: StorybookConfig = {
	stories: ["../src/**/*.mdx", "../src/**/*.stories.@(js|jsx|ts|tsx|svelte)"],
	addons: [
		"@storybook/addon-essentials",
		{
			name: "@storybook/addon-svelte-csf",
			options: {
				legacyTemplate: true
			}
		},
		"@storybook/addon-a11y"
	],
	framework: "@storybook/sveltekit"
};

export default config;
