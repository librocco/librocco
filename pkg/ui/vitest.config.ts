/// <reference types="vitest" />
import { defineConfig } from 'vite';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
	plugins: [sveltekit()],
	test: {
		globals: true,
		environment: 'jsdom',
		deps: { inline: true },
		// Add @testing-library/jest-dom matchers and mock modules
		setupFiles: ['./vitest.setup.ts']
	}
});
