/**
 * Extend template config to use provided `tsconfig.json` files for parsing and resolution.
 * This is especially useful when using path aliases from tsconfig
 * @param {Object} config eslint config to extend
 * @param {Array<string>} tsPaths a non-empty string array of tsconfig paths
 */
exports.useTSConfig = (config, tsPaths) => {
	if (!config) {
		throw new Error(
			"[useTSPaths] No config received. Config should be a valid eslint config object"
		);
	}
	if (!(tsPaths instanceof Array) || !tsPaths.length) {
		throw new Error("[useTSPaths] tsPaths shoud be a non-empty array of string paths");
	}

	// Extract parserOptions and settings from base config
	const { parserOptions: baseParserOptions = {}, settings: baseSettings = {} } = config;

	// Add typescript paths to parserOptions
	const parserOptions = { ...baseParserOptions, project: tsPaths };

	// Add typescript paths to 'settings["import/resolver"].typescript', creating
	// 'settings', 'import/resolver', 'typescript' segments if they don't exist
	const { baseImportResolver = {} } = baseSettings;
	const { typescriptResolver = {} } = baseImportResolver;
	const settings = {
		...baseSettings,
		"import/resolver": {
			...baseImportResolver,
			typescript: { ...typescriptResolver, project: tsPaths },
		},
	};

	return {
		...config,
		parserOptions,
		settings,
	};
};
