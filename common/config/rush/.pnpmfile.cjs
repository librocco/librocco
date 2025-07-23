// common/config/rush/.pnpmfile.cjs
'use strict';

const path = require('path');
const fs = require('fs');


module.exports = {
	hooks: {
		// running this so that we don't have absolute paths in the lockfile when updating the local .tar deps
		afterAllResolved: (lockfile, context) => {
			const artefactsRelPath = '../../../3rd-party/artefacts'
			const tarballFiles = new Set(fs.readdirSync(path.join(__dirname, artefactsRelPath)).filter(file => file.endsWith('.tgz')))

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

					const relativePath = `file:${path.join(artefactsRelPath, basename)}`

					if (tarballFiles.has(basename)) {
						const _old = specifier
						const _new = relativePath

						context.log(`replacing specifier ${_old} -> ${_new}`);
						importer.specifiers[depName] = relativePath
					}
				}
			}

			return lockfile;
		}
	}
};
