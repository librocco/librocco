import { defineConfig } from 'vite';
import { defineConfig as defineVitestConfig } from 'vitest/config';
import path from 'path';

const config =
	process.env.NODE_ENV === 'test'
		? // We're using a special config for tests, to enable
		  // inlining tests to source files
		  defineVitestConfig({
				test: {
					includeSource: ['src/**/*.ts']
				}
		  })
		: defineConfig({
				build: {
					lib: {
						name: '@librocco/database',
						entry: path.join(__dirname, 'src', 'index.ts'),
						fileName: (fmt) => (fmt === 'es' ? 'index.es.js' : 'index.js'),
						formats: ['es', 'cjs']
					},
					rollupOptions: {
						output: {
							exports: 'named'
						}
					},
					outDir: 'dist'
				}
		  });

export default config;
