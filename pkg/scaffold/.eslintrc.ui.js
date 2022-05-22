const scaffold = require("./.eslintrc.js");

module.exports = {
  ...scaffold,
  extends: [
    ...scaffold.extends,
    "plugin:import/react",
    "plugin:react-hooks/recommended",
  ],
  rules: {
    ...scaffold.rules,
    // even though Dan Abramov spreads this gospel, we're
    // carefully setting the deps to precisely what we want
    "react-hooks/exhaustive-deps": "off",
  },
};
