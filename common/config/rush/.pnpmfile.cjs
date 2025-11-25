// common/config/rush/.pnpmfile.cjs
'use strict';

const path = require('path');
const fs = require('fs');


module.exports = {
	hooks: {
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
