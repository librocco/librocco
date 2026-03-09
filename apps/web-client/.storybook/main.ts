import path from "path";
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
	framework: "@storybook/sveltekit",
	async viteFinal(config) {
		return {
			...config,
			resolve: {
				...config.resolve,
				alias: {
					...(config.resolve?.alias ?? {}),
					"$env/dynamic/public": path.resolve(__dirname, "../src/__mocks__/$env-dynamic-public.ts"),
					"$env/static/public": path.resolve(__dirname, "../src/__mocks__/$env-static-public.ts")
				}
			}
		};
	}
};

export default config;
