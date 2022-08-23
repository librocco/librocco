import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
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
