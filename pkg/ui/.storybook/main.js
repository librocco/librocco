const path = require("path");

const svgrOptions = require("../../scaffold/svgrOptions");

module.exports = {
  stories: ["../src/**/*.stories.mdx", "../src/**/*.stories.@(js|jsx|ts|tsx)"],
  addons: [
    "storybook-addon-pseudo-states",
    "@storybook/addon-links",
    "@storybook/addon-essentials",
    "@storybook/addon-interactions",
    {
      name: "@storybook/addon-postcss",
      options: {
        postcssLoaderOptions: {
          // When using postCSS 8
          implementation: require("postcss"),
        },
      },
    },
  ],
  framework: "@storybook/react",

  webpackFinal: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@assets": path.join(__dirname, "..", "src", "assets"),
    };

    const fileLoaderRule = config.module.rules.find(
      (rule) => rule.test && rule.test.test(".svg")
    );
    fileLoaderRule.exclude = /\.svg$/;

    config.module.rules.push({
      test: /\.svg$/,
      use: [
        {
          loader: "@svgr/webpack",
          options: svgrOptions,
        },
      ],
    });

    return config;
  },
};
