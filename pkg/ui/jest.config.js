module.exports = {
  moduleNameMapper: {
    "@/(.*)": "<rootDir>/src/$1",
    "\\.svg": "<rootDir>/src/__mocks__/svg.ts",
    "@mui/styles/makeStyles": "<rootDir>/src/__mocks__/makeStyles.ts",
  },
  globalSetup: "<rootDir>/src/__testSetup__/initTests.ts",
  collectCoverageFrom: [
    "src/**/*.{ts,tsx}",
    "src/*.{ts,tsx}",
    "functions/**/*.{ts,tsx}",
    "functions/*.{ts,tsx}",
    "!dist/**",
    "!**/node_modules/**",
  ],
  coveragePathIgnorePatterns: ["node_modules", ".*\\.stories\\.tsx"],
  testTimeout: 10000,
};
