module.exports = {
  moduleNameMapper: {
    "@/(.*)": "<rootDir>/src/$1",
  },
  collectCoverageFrom: [
    "src/**/*.{ts,tsx}",
    "src/*.{ts,tsx}",
    "!dist/**",
    "!**/node_modules/**",
  ],
  coveragePathIgnorePatterns: ["node_modules"],
  testTimeout: 10000,
};
