import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
	resolve: {
		alias: {
			'@': path.join(__dirname, 'src'),
			'@runner': path.join(__dirname, 'src/runner'),
			'@tests': path.join(__dirname, 'src/tests'),
			'@loaders': path.join(__dirname, 'src/data-loaders'),
			'@unit-tests': path.join(__dirname, 'src/__tests__'),
			'@unit-test-data': path.join(__dirname, 'src/__testData__')
		}
	},
	build: {
		lib: {
			name: '@librocco/datamodel-tests',
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
