import { AppConfig } from "./config";
import { initializeDb } from "./db";
import { App } from "./core";

import type { VFSWhitelist } from "$lib/db/cr-sqlite/core";
import { newPluginsInterface, type PluginsInterface } from "$lib/plugins";

export type CreateTestAppOptions = {
	dbid?: string;
	vfs?: VFSWhitelist;
};

export type TestContext = {
	app: App;
	plugins: PluginsInterface;
};

export const DEFAULT_TEST_VFS: VFSWhitelist = "sync-opfs-coop-sync";

const getRandomTestDbid = (): string => `storybook_test_${Date.now()}_${Math.floor(Math.random() * 1000000000)}`;

/**
 * Build a minimal app instance intended for Storybook tests.
 *
 * The returned app has:
 * - core app scaffold (`new App()`)
 * - in-memory config stores (`AppConfig.memory()`)
 * - an initialized database with a fresh random DBID
 */
export async function createTestApp(options: CreateTestAppOptions = {}): Promise<App> {
	const testApp = new App();
	testApp.config = AppConfig.memory(); // NOTE: this isn't memory VFS - merely the config is stored in memory

	const dbid = options.dbid ?? getRandomTestDbid();
	const vfs = options.vfs ?? DEFAULT_TEST_VFS;

	await initializeDb(testApp, dbid, vfs);

	return testApp;
}

export async function createTestContext(options: CreateTestAppOptions = {}): Promise<TestContext> {
	const app = await createTestApp(options);
	const plugins = newPluginsInterface();

	return { app, plugins };
}
