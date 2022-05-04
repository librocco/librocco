const plugins = [
  ["@babel/plugin-proposal-private-methods", { loose: true }],
  ["@babel/plugin-proposal-class-properties", { loose: true }],
  ["@babel/plugin-proposal-private-property-in-object", { loose: true }],
  [
    "@babel/transform-runtime",
    {
      helpers: false,
      regenerator: true,
    },
  ],
];

const presets = ["@babel/env", "@babel/react", "@babel/typescript"];

module.exports = { plugins, presets };
