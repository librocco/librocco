// common/config/rush/.pnpmfile.cjs
'use strict';

const path = require('path');
const fs = require('fs');


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
		},
		// Running this so that we don't have absolute paths in the lockfile when updating the local .tar deps
		//
		// We have the following scenario:
		// - package.json imports specify versions (latest) for vlcn.io packages (e.g. in web-client)
		// - vlcn.io packages depend on eachother internally -- overriding specifiers in our packages (setting to file:...)
		//   doesn't override interdependencies (leading to multiple versions of same package being used)
		// - we specify 'globalOverrides' in 'common/config/rush/pnpm-config.json' to override deps (at resolution time) to use
		//   tarballs in '3rd-party/artefacts'
		// - with overrides in place Rush and pnpm (whichever) resolve the absolute path (which is variable depending on each dev's fs layout), e.g.:
		//   - specifier: "file:/Users/<user-name>/dev-workspace/librocco/3rd-party/..." (resolved absolute path)
		//   - version: "file:../../3rd-party/..." (pnpm globalOverride - relative to each package root, e.g. apps/web-client)
		// - when Rush sees the mismatch (above) it triggers shrinkwrap invalidtion - resulting in slow and unnecessary `rush update` on each call
		// - we perform the hack to (manually) override the specifier so that the requested version (specifier) matches the installed version
		afterAllResolved: (lockfile, context) => {
			const artefactsPath = path.join(__dirname, '..', '..', '..', '3rd-party/artefacts')
			const tarballFiles = new Set(fs.readdirSync(artefactsPath).filter(file => file.endsWith('.tgz')))

			const artefactsPathOverride = '../../3rd-party/artefacts'

			context.log("tarball files:")
			for (const file of tarballFiles) {
				context.log(`- ${file}`);
			}

			for (const importerName in lockfile.importers) {
				const importer = lockfile.importers[importerName];
				if (!importer.specifiers) continue;

				for (const depName in importer.specifiers) {
					const specifier = importer.specifiers[depName];
					if (!specifier.startsWith('file:') || !specifier.endsWith(".tgz")) continue;

					const basename = path.basename(specifier);

					const pathOverride = path.join(artefactsPathOverride, basename)
					const specifierOverride = `file:${pathOverride}`

					if (tarballFiles.has(basename)) {
						const _old = specifier
						const _new = specifierOverride

						context.log(`replacing specifier ${_old} -> ${_new}`);
						importer.specifiers[depName] = _new
					}
				}
			}

			return lockfile;
		}
	}
};
