const path = require("path");

const scaffold = require("../scaffold/.eslintrc.js");
const { useTSConfig } = require("../scaffold/.eslint.utils.js");

module.exports = useTSConfig(scaffold, [path.join(__dirname, "tsconfig.json")]);
