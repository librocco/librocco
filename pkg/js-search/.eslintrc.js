const path = require("path");

const scaffold = require("../scaffold/.eslintrc.js");
const { useTSConfig } = require("../scaffold/.eslint.utils.js");

const tsPaths = [path.join(__dirname, "./tsconfig.json")];

module.exports = useTSConfig(
  {
    ...scaffold,
    rules: {
      ...scaffold.rules,

      // // Removed rule "disallow the use of console" from recommended eslint rules
      // "no-console": "warn",

      // Enforces the use of catch() on un-returned promises
      "promise/catch-or-return": 2,

      // Warn against nested then() or catch() statements
      "promise/no-nesting": 1,
    },
    ignorePatterns: [...scaffold.ignorePatterns, "benchmarks/"],
  },
  tsPaths
);
