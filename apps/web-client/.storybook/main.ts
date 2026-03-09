import type { StorybookConfig } from "@storybook/sveltekit";

const config: StorybookConfig = {
	stories: ["../src/**/*.stories.@(js|jsx|ts|tsx|svelte)"],
	addons: [
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
