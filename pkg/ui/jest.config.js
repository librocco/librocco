module.exports = {
  moduleNameMapper: {
    "@/(.*)": "<rootDir>/src/$1",
    "\\.svg": "<rootDir>/src/__mocks__/svg.ts",
  },
  collectCoverageFrom: [
    "src/**/*.{ts,tsx}",
    "src/*.{ts,tsx}",
    "!dist/**",
    "!**/node_modules/**",
  ],
  testEnvironment: "jsdom",
  coveragePathIgnorePatterns: ["node_modules", ".*\\.stories\\.tsx"],
  testTimeout: 10000,
};
