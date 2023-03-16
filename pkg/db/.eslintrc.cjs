const path = require('path');
const { useTSConfig } = require('../scaffold/.eslint.utils.js');

module.exports = useTSConfig(
	{
		root: true,
		parser: '@typescript-eslint/parser',
		extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended', 'prettier'],
		plugins: ['@typescript-eslint'],
		ignorePatterns: ['*.cjs'],
		parserOptions: {
			sourceType: 'module',
			ecmaVersion: 2020
		},
		settings: {
			'import/resolver': {}
		},
		env: {
			browser: true,
			es2017: true,
			node: true
		}
	},
	[path.join(__dirname, 'tsconfig.json')]
);
