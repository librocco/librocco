import type { StorybookConfig } from "@storybook/sveltekit";

const config: StorybookConfig = {
	stories: ["../src/**/*.mdx", "../src/**/*.stories.@(js|jsx|ts|tsx|svelte)"],
	addons: ["@storybook/addon-essentials", "@storybook/addon-svelte-csf", "@storybook/addon-a11y"],
	framework: "@storybook/sveltekit"
};

export default config;
