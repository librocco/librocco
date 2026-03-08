import type { StorybookConfig } from "@storybook/sveltekit";

const isVitestRun = !!process.env.VITEST;

const config: StorybookConfig = {
	stories: isVitestRun
		? ["../src/routes/**/*.stories.@(js|jsx|ts|tsx|svelte)"]
		: ["../src/**/*.mdx", "../src/**/*.stories.@(js|jsx|ts|tsx|svelte)"],
	addons: [
		{
			name: "@storybook/addon-svelte-csf",
			options: {
				legacyTemplate: true
			}
		},
		"@storybook/addon-a11y",
		"@storybook/addon-vitest"
	],
	framework: "@storybook/sveltekit"
};

export default config;
