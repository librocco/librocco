// common/config/rush/.pnpmfile.cjs
'use strict';

module.exports = {
	hooks: {
		// Normalize peer deps for known optional extras and Svelte/Storybook gaps:
		// - ignoredPeers: delete noisy optional peers from package manifests before resolution.
		//   This keeps strictPeerDependencies on despite upstream packages declaring optional
		//   peers as required. Tradeoff: we mute peer signals for these extras; if you start
		//   using one, add it as a real dep or remove it from the ignore set. We can shrink
		//   this list when: a) upstreams correctly mark them optional, or b) we actually
		//   install/need them.
		// - peerOverrides: widen Storybook/Svelte ranges to allow Svelte 5 + vite-plugin-svelte 5,
		//   and keep svelte-htm relaxed/optional to avoid conflicts.
		// This reduces lockfile churn and keeps installs green under strict peers.
		// NOTE: readPackage is called for every package being installed; we use it to rewrite
		// dependency metadata from upstream packages where their peer declarations are incorrect.
		readPackage(pkg, context) {
			const ignoredPeers = new Set([
				"@cloudflare/workers-types",
				"@edge-runtime/vm",
				"@ianvs/prettier-plugin-sort-imports",
				"@prettier/plugin-hermes",
				"@prettier/plugin-oxc",
				"@prettier/plugin-pug",
				"@shopify/prettier-plugin-liquid",
				"@trivago/prettier-plugin-sort-imports",
				"@types/debug",
				"@types/react",
				"babel-plugin-macros",
				"bufferutil",
				"canvas",
				"coffeescript",
				"encoding",
				"happy-dom",
				"jiti",
				"less",
				"lightningcss",
				"pug",
				"safaridriver",
				"sass",
				"sass-embedded",
				"stylus",
				"sugarss",
				"supports-color",
				"terser",
				"ts-node",
				"utf-8-validate",
				"webdriverio",
				"yaml",
				"@zackad/prettier-plugin-twig",
				"@shopify/prettier-plugin-liquid",
				"@trivago/prettier-plugin-sort-imports",
				"prettier-plugin-astro",
				"prettier-plugin-css-order",
				"prettier-plugin-import-sort",
				"prettier-plugin-jsdoc",
				"prettier-plugin-marko",
				"prettier-plugin-multiline-arrays",
				"prettier-plugin-organize-attributes",
				"prettier-plugin-organize-imports",
				"prettier-plugin-sort-imports",
				"prettier-plugin-style-order"
			]);

			if (pkg.peerDependencies) {
				for (const peerName of Object.keys(pkg.peerDependencies)) {
					if (ignoredPeers.has(peerName)) {
						delete pkg.peerDependencies[peerName];
					}
				}

				if (Object.keys(pkg.peerDependencies).length === 0) {
					delete pkg.peerDependencies;
				}
			}

			const peerOverrides = {
				"@storybook/addon-svelte-csf": {
					"@sveltejs/vite-plugin-svelte": "*",
					svelte: "*",
					vite: "*"
				},
				"svelte-htm": {
					svelte: ">=3 <6"
				}
			};

			if (peerOverrides[pkg.name]) {
				pkg.peerDependencies = {
					...(pkg.peerDependencies || {}),
					...peerOverrides[pkg.name]
				};
			}

			if (pkg.name === "@storybook/addon-svelte-csf") {
				pkg.peerDependenciesMeta = {
					...(pkg.peerDependenciesMeta || {}),
					"@sveltejs/vite-plugin-svelte": { optional: true },
					svelte: { optional: true },
					vite: { optional: true }
				};
			}

			if (pkg.name === "svelte-htm") {
				pkg.peerDependenciesMeta = {
					...(pkg.peerDependenciesMeta || {}),
					svelte: { optional: true }
				};
			}

			return pkg;
		}
	}
};
