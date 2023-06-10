const path = require("path");

const { useTSConfig } = require("../scaffold/.eslint.utils.js");
const scaffoldConfig = require("../scaffold/.eslintrc.cjs");

const tsPaths = [path.join(__dirname, "./tsconfig.json")];

module.exports = useTSConfig(scaffoldConfig, tsPaths);
