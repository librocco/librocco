const path = require("path");

const scaffold = require("../pkg/scaffold/.eslintrc.ui.js");
const { useTSConfig } = require("../pkg/scaffold/.eslint.utils.js");

module.exports = useTSConfig(
  {
    ...scaffold,
    ignorePatterns: [
      ...scaffold.ignorePatterns,
      "csv-to-couchdb.ts",
    ],
  },
  [path.join(__dirname, "tsconfig.json")]
);
