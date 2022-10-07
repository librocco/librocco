const path = require('path');

const { useTSConfig } = require('../../pkg/scaffold/.eslint.utils.js');

const tsPaths = [path.join(__dirname, './tsconfig.json')];

module.exports = useTSConfig(
	{
		root: true,
		parser: '@typescript-eslint/parser',
		extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended', 'prettier'],
		plugins: ['svelte3', '@typescript-eslint'],
		ignorePatterns: ['*.cjs', '*.config.js'],
		overrides: [{ files: ['*.svelte'], processor: 'svelte3/svelte3' }],
		settings: {
			'svelte3/typescript': () => require('typescript')
		},
		parserOptions: {
			sourceType: 'module',
			ecmaVersion: 2020
		},
		env: {
			browser: true,
			es2017: true,
			node: true
		}
	},
	tsPaths
);
