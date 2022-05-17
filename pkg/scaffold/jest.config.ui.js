const baseConfig = require("./jest.config.js");

module.exports = {
  ...baseConfig,
  moduleNameMapper: {
    // We're using this to mock svgr powered SVG imports
    // It's important that the svg path mock appears before rest of the module name mappings
    // To avoid '.svg' files being caught by path aliases and lead to an actual file instead of the mock
    //
    // To make use of this path mocking, it is necesary to have a file at given mock path, providing a react componet
    // returning null (to mock svgr loaded svg file without any overhead)
    //
    // Note: SVGs can't be tested this way. If you wish to test SVGs being loaded properly, you either need to extend the mock file
    // with testable functionality, or cange the SVG loading logic altogether for more explicit testing.
    "\\.svg": "<rootDir>/src/__mocks__/svg.ts",
    ...baseConfig.moduleNameMapper,
  },
  coveragePathIgnorePatterns: [
    ...baseConfig.coveragePathIgnorePatterns,

    // For UI, the usage of storybook is implied, but should be ignored for test coverage
    ".*\\.stories\\.tsx",
  ],
  testEnvironment: "jsdom",
};
