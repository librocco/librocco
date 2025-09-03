import { defineConfig, devices, PlaywrightTestConfig, ReporterDescription } from "@playwright/test";

import { IS_CI, VFS_TEST, SHARD_INDEX, baseURL } from "./constants";

const reporter: ReporterDescription[] = [["list"]];
// Produce a merge‑able blob report when running in CI
if (IS_CI) {
	reporter.push(["blob"]);
}

const browsers = [
	{
		name: "chromium",
		device: devices["Desktop Chrome"]
	},
	{
		name: "firefox",
		device: devices["Desktop FireFox"]
	}

	// Skipped as some tests are failing on webkit in CI. The functionality is there and we wish to still
	// run those tests, and have the ability for PRs to be green.
	// TODO: Uncomment this when we have time to fix the tests failing on webkit:
	// - scan input
	// - enter form submission
	//
	// {
	// 	name: "webkit",
	// 	device: devices["Desktop Safari"]
	// }

	/* Test against mobile viewports. */
	// {
	//   name: 'Mobile Chrome',
	//   device: devices['Pixel 5']
	// },
	// {
	//   name: 'Mobile Safari',
	//   device: devices['iPhone 12']
	// },

	/* Test against branded browsers. */
	// {
	//   name: 'Microsoft Edge',
	//   device: devices['Desktop Edge']
	// },
	// {
	//   name: 'Google Chrome',
	//   device: devices['Desktop Chrome']
	// },
];

const locales = ["en"];

const baseConfig: PlaywrightTestConfig = {
	testDir: "./integration",
	/* Run tests in files in parallel */
	fullyParallel: false,
	/* Fail the build on CI if you accidentally left test.only in the source code. */
	forbidOnly: IS_CI,
	/* Retry for local test run (normally, the tests ran using the UI will not be flaky, but headless tests might take a toll on the CPU, resulting in flaky tests) */
	retries: 1,
	timeout: 15000,
	globalTimeout: 55 * 60 * 1000, // 55 minutes of global timeout - the github job has a 60 minutes limit
	/* Opt out of parallel tests on CI. */
	workers: IS_CI ? 1 : undefined,
	/* Reporter to use. See https://playwright.dev/docs/test-reporters */
	reporter: reporter,
	/* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
	use: {
		/* Base URL to use in actions like `await page.goto('/')`. */
		// baseURL: 'http://127.0.0.1:3000',
		baseURL: baseURL,
		/* Collect trace for failed test. See https://playwright.dev/docs/trace-viewer */
		trace: "retain-on-failure",
		/** Record video for all test runs and retain for failed tests. See https://playwright.dev/docs/videos */
		video: "retain-on-failure"
	}
};

const defaultConfig: PlaywrightTestConfig = {
	...baseConfig,
	reporter,
	projects: browsers
		.flatMap((browser) => locales.map((locale) => ({ ...browser, locale })))
		.map(({ name, device, locale }) => ({
			name,
			use: { ...device, locale }
		}))
};

const vfsList = [
	"asyncify-idb-batch-atomic",
	"asyncify-opfs-any-context",
	"asyncify-opfs-adaptive",

	"asyncify-opfs-coop-sync",
	"sync-opfs-coop-sync"

	// "jspi-opfs-permuted"
];
const outputFile =
	SHARD_INDEX === undefined ? `vfs-benchmark-results/test-results.json` : `vfs-benchmark-results/test-results-${SHARD_INDEX}.json`;
const vfsTestConfig: PlaywrightTestConfig = {
	...baseConfig,
	reporter: [...reporter, ["json", { outputFile }]],
	projects: browsers // NOTE: using all browsers, but only the default locale in this scenario
		.flatMap((browser) => vfsList.map((vfs) => ({ name: [browser.name, vfs].join("-"), device: browser.device, vfs })))
		.map(({ name, device, vfs }) => ({
			name,
			use: {
				...device,
				locale: locales[0],
				storageState: { origins: [{ origin: new URL(baseURL).origin, localStorage: [{ name: "vfs", value: vfs }] }], cookies: [] as any[] }
			}
		}))
};

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig(VFS_TEST ? vfsTestConfig : defaultConfig);
