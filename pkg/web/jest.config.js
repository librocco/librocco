const jestConfig = require("../scaffold/jest.config.js");
const jestConfigUI = require("../scaffold/jest.config.ui.js");

module.exports = {
  // We wish to specify test environment on per file basis, rather than it being set for all of the tests
  // thus, we're extending base jest config, with some hand picked settings from UI setup
  ...jestConfig,
  moduleNameMapper: jestConfigUI.moduleNameMapper,
  coveragePathIgnorePatterns: jestConfigUI.coveragePathIgnorePatterns,
};
