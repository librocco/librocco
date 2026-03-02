const path = require("path");

/** @type {import("@storybook/sveltekit").StorybookConfig} */
const config = {
	stories: ["../src/**/*.mdx", "../src/**/*.stories.@(js|jsx|ts|tsx|svelte)"],
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
	viteFinal: async (config) => {
		const envStaticPublicMock = path.resolve(__dirname, "../src/__mocks__/$env-static-public.ts");
		const envDynamicPublicMock = path.resolve(__dirname, "../src/__mocks__/$env-dynamic-public.ts");

		return {
			...config,
			resolve: {
				...(config.resolve ?? {}),
				alias: {
					...(config.resolve?.alias ?? {}),
					"$env/static/public": envStaticPublicMock,
					"$env/dynamic/public": envDynamicPublicMock
				}
			},
			optimizeDeps: {
				...(config.optimizeDeps ?? {}),
				esbuildOptions: {
					...(config.optimizeDeps?.esbuildOptions ?? {}),
					alias: {
						...(config.optimizeDeps?.esbuildOptions?.alias ?? {}),
						"$env/static/public": envStaticPublicMock,
						"$env/dynamic/public": envDynamicPublicMock
					}
				}
			}
		};
	}
};

module.exports = config;
