#!/usr/bin/env node

/**
 * esbuild configuration for bundling the sync server
 * This bundles the TypeScript sync server into a single JavaScript file
 * while keeping native modules (better-sqlite3) external
 */

import * as esbuild from 'esbuild';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.join(__dirname, 'dist');

// Ensure dist directory exists
if (!fs.existsSync(distDir)) {
	fs.mkdirSync(distDir, { recursive: true });
}

try {
	console.log('Building sync server...');

	await esbuild.build({
		entryPoints: ['src/index.ts'],
		bundle: true,
		platform: 'node',
		target: 'node20',
		format: 'esm',
		outfile: 'dist/syncserver.mjs',
		banner: {
			js: 'import { createRequire } from "module"; const require = createRequire(import.meta.url);'
		},
		external: [
			'better-sqlite3',
			'@vlcn.io/*',
			'node-gyp-build',
			'bindings'
		],
		sourcemap: true,
		logLevel: 'info'
	});

	console.log('✓ Sync server bundled successfully to dist/syncserver.mjs');
} catch (error) {
	console.error('✗ Build failed:', error.message);
	process.exit(1);
}
