import adapter from "@sveltejs/adapter-static";
import preprocess from "svelte-preprocess";
import { execSync } from "child_process";

const base = execSync("git symbolic-ref --short HEAD").toString().trim();
/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://github.com/sveltejs/svelte-preprocess
	// for more information about preprocessors
	preprocess: preprocess(),

	kit: {
		adapter: adapter({ fallback: "index.html" }),
		prerender: {
			entries: ["/inventory/stock", "/inventory/inbound", "/inventory/outbound", "/debug"]
		},
		paths: {
			base: `/${base}`
		},
		typescript: {
			config: (config) => ({
				...config,
				compilerOptions: {
					...config.compilerOptions,
					resolveJsonModule: true,
					allowSyntheticDefaultImports: true
				}
			})
		}
	}
};

export default config;
