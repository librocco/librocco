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
    throw new Error(
      "[useTSPaths] tsPaths shoud be a non-empty array of string paths"
    );
  }

  return {
    ...config,
    parserOptions: { ...config.parserOptions, project: tsPaths },
    settings: {
      ...config.settings,
      "import/resolver": {
        ...config.settings["import/resolver"],
        typescript: {
          ...config.settings["import/resolver"]?.typescript,
          project: tsPaths,
        },
      },
    },
  };
};
