module.exports = {
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: "module",
  },
  settings: {
    "import/parsers": {
      "@typescript-eslint/parser": [".ts", ".tsx"],
    },
    "import/resolver": {
      typescript: {},
    },
  },
  plugins: ["promise", "import"],
  extends: [
    "google",
    "eslint:recommended",
    "plugin:import/errors",
    "plugin:import/warnings",
    "plugin:import/typescript",
    "plugin:promise/recommended",
    "plugin:@typescript-eslint/recommended",
  ],
  ignorePatterns: [
    "build/",
    "dist/",
    "node_modules/",
    ".eslintrc.js",
    ".eslintrc.ui.js",
    "vite.config.ts",
  ],
  rules: {
    // Using this rule would mean that every object literal should have quotes as properties, as such { "foo": true }
    // Which is pretty outdated behaviour
    "quote-props": "off",

    // Removed rule "disallow the use of console" from recommended eslint rules
    "no-console": "off",

    // Warn against template literal placeholder syntax in regular strings
    // i.e. "${foo}" should be illegal as it's most likely a mistake, trying to write `${foo}`
    "no-template-curly-in-string": 1,

    // Warn if return statements do not either always or never specify values
    "consistent-return": 1,

    // Warn if no return statements in callbacks of array methods
    "array-callback-return": 1,

    // Require the use of === and !==
    eqeqeq: 2,

    // Disallow the use of alert, confirm, and prompt
    "no-alert": 2,

    // Disallow the use of `arguments.caller` or `arguments.callee`
    // This is an old JS practice not used as much anymore
    // We're disallowing it nonetheless
    "no-caller": 2,

    // Disallow the use of eval()
    "no-eval": 2,

    // Warn against extending native types
    "no-extend-native": 2,

    // Warn against unnecessary calls to .bind()
    "no-extra-bind": 1,

    // Warn against unnecessary labels
    "no-extra-label": 1,

    // Disallow leading or trailing decimal points in numeric literals
    "no-floating-decimal": 2,

    // Type conversions should be as clear as possible (i.e. Number("4") rather than +"4")
    "no-implicit-coercion": 2,

    // Function declarations and expressions inside loop statements seem like a baad practice
    "no-loop-func": 2,

    // Disallow new operators with the Function object
    "no-new-func": 2,

    // Using new operators with the String, Number, and Boolean objects
    // is really unnecessary
    "no-new-wrappers": 2,

    // Disallow throwing exceptions that are anything other than `Error(<message>)`
    "no-throw-literal": 2,

    // Require using Error objects as Promise rejection reasons
    "prefer-promise-reject-errors": 2,

    // Enforce “for” loop update clause moving the counter in the right direction
    "for-direction": 2,

    // Enforce return statements in getters
    "getter-return": 2,

    // Disallow await inside of loops
    // This is a good practice most of the time, so it makes sense
    // to override it only when (and if) really necessary
    "no-await-in-loop": 2,

    // Disallow comparing against -0
    "no-compare-neg-zero": 2,

    // Warn against catch clause parameters from shadowing variables in the outer scope
    "no-catch-shadow": 1,

    // Disallow identifiers from shadowing restricted names
    "no-shadow-restricted-names": 2,

    // Warn against string concatenation with __dirname and __filename
    "no-path-concat": 1,

    // Prefer using arrow functions for callbacks
    "prefer-arrow-callback": 1,

    // Swotch strings to single quote (offset recommended)
    quotes: "off",

    // Allow spacing in curly braces (we're actually using this for readability)
    "object-curly-spacing": "off",

    // Max len is handled by prettier, if it turns out to be longer it's probbably a comment
    "max-len": "off",

    // Indentation is handled by prettier
    indent: "off",

    // Allow "?" and ":" to be at the beginning of the line in ternary expressions
    "operator-linebreak": "off",

    // Produces false positives in long function arguments, handled by prettier anyhow
    "comma-dangle": "off",

    // We use TypeScript for type annotation, JS Doc is here as documentation
    "valid-jsdoc": "off",

    // Allow for non-null asssertion as they're not inferred by TS with cloud functions
    "@typescript-eslint/no-non-null-assertion": "off",

    // Allow explicit any, but still avoid where possible
    "@typescript-eslint/no-explicit-any": "off",

    // we're using empty functions as fallback for undefined props
    "@typescript-eslint/no-empty-function": "off",

    // This just gets in the way
    "import/no-named-as-default-member": "off",
    "import/no-named-as-default": "off",

    // we're turning this off as it produces false positives on imported namespaces (i.e. react)
    "import/default": "off",

    // no-case-declarations
    "no-case-declarations": "off",
  },
};
