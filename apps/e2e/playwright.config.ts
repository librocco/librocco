import { defineConfig, devices } from "@playwright/test";
import type { Config } from "@playwright/test";

import { IS_CI, VFS_TEST, SHARD_INDEX, baseURL, FULLY_PARALLEL, CI_WORKERS } from "./constants";

const reporter: Config["reporter"] = [["list"]];
// Produce a merge‑able blob report when running in CI
if (IS_CI) {
	reporter.push(["blob"]);
}

// Available browser projects. webkit is omitted because some tests fail on it in
// CI (scan input, enter form submission) — TODO: re-enable once those are fixed.
const availableBrowsers: Record<string, (typeof devices)[string]> = {
	chromium: devices["Desktop Chrome"],
	firefox: devices["Desktop FireFox"]

	// webkit: devices["Desktop Safari"],
	/* Mobile viewports: */
	// "Mobile Chrome": devices["Pixel 5"],
	// "Mobile Safari": devices["iPhone 12"],
	/* Branded browsers: */
	// "Microsoft Edge": devices["Desktop Edge"],
	// "Google Chrome": devices["Desktop Chrome"],
};

// Which browsers the (non-sync) suite runs on. Defaults to both, so nightly
// playwright-matrix, the VFS benchmark and local runs keep full coverage. PR
// runs set PLAYWRIGHT_BROWSERS=chromium to halve per-shard test time; the
// firefox-only "sync" project (below) keeps sync coverage on firefox regardless.
const BROWSERS = (process.env.PLAYWRIGHT_BROWSERS ?? "chromium,firefox")
	.split(",")
	.map((s) => s.trim())
	.filter(Boolean);
const browsers = BROWSERS.map((name) => ({ name, device: availableBrowsers[name] }));

const locales = ["en"];

const baseConfig: Config = {
	testDir: "./integration",
	/* Run tests in files in parallel */
	fullyParallel: FULLY_PARALLEL,
	/* Fail the build on CI if you accidentally left test.only in the source code. */
	forbidOnly: IS_CI,
	/* Retry for local test run (normally, the tests ran using the UI will not be flaky, but headless tests might take a toll on the CPU, resulting in flaky tests) */
	retries: 1,
	// Per-test timeout. Higher in CI: with parallel workers, data-heavy tests
	// (e.g. progressive list loading) slow under CPU contention; the extra ceiling
	// is headroom only — it never delays a passing test.
	timeout: IS_CI ? 30000 : 15000,
	globalTimeout: 55 * 60 * 1000, // 55 minutes of global timeout - the github job has a 60 minutes limit
	/* In CI, parallelise across PLAYWRIGHT_WORKERS workers (default 1). With
	 * fullyParallel=false this parallelises whole spec files, keeping each file —
	 * notably sync.spec.ts, the only file using the shared sync server — serial. */
	workers: IS_CI ? CI_WORKERS : undefined,
	/* Reporter to use. See https://playwright.dev/docs/test-reporters */
	reporter: reporter,
	/* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
	use: {
		/* Base URL to use in actions like `await page.goto('/')`. */
		// baseURL: 'http://127.0.0.1:3000',
		baseURL: baseURL,
		/* Accept self-signed certificates from Caddy in CI */
		ignoreHTTPSErrors: true,
		/* Collect trace for failed test. See https://playwright.dev/docs/trace-viewer */
		trace: "retain-on-failure",
		/** Record video for all test runs and retain for failed tests. See https://playwright.dev/docs/videos */
		video: "retain-on-failure",
		/**
		 * Seed a deterministic workstation name: notes created through the UI are named
		 * "<Sale|Purchase> <workstation name>" (the name is otherwise randomly generated on first use)
		 */
		storageState: {
			origins: [
				{
					origin: new URL(baseURL).origin,
					localStorage: [
						{ name: "librocco:settings", value: JSON.stringify({ workstationName: "Alpha", labelPrinterUrl: "", receiptPrinterUrl: "" }) }
					]
				}
			],
			cookies: [] as any[]
		}
	}
};

// sync.spec.ts drives a single process-global sync server (start/stop via circus),
// so it must run as exactly ONE task — never duplicated across browser projects, or
// parallel workers would race on stopping/starting that shared server. Pin it to a
// single browser (firefox, which has historically surfaced real sync regressions)
// and exclude it from the per-browser projects.
const SYNC_SPEC = /sync\.spec\.ts/;
const syncProject = {
	name: "sync",
	testMatch: SYNC_SPEC,
	use: { ...devices["Desktop FireFox"], locale: locales[0] }
};

const defaultConfig: Config = {
	...baseConfig,
	reporter,
	projects: [
		...browsers
			.flatMap((browser) => locales.map((locale) => ({ ...browser, locale })))
			.map(({ name, device, locale }) => ({
				name,
				testIgnore: SYNC_SPEC,
				use: { ...device, locale }
			})),
		syncProject
	]
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
const vfsTestConfig: Config = {
	...baseConfig,
	reporter: [...reporter, ["json", { outputFile }]],
	projects: browsers // NOTE: using all browsers, but only the default locale in this scenario
		.flatMap((browser) => vfsList.map((vfs) => ({ name: [browser.name, vfs].join("-"), device: browser.device, vfs })))
		.map(({ name, device, vfs }) => ({
			name,
			use: {
				...device,
				locale: locales[0],
				storageState: {
					origins: [
						{
							origin: new URL(baseURL).origin,
							localStorage: [
								{ name: "vfs", value: vfs },
								{
									name: "librocco:settings",
									value: JSON.stringify({ workstationName: "Alpha", labelPrinterUrl: "", receiptPrinterUrl: "" })
								}
							]
						}
					],
					cookies: [] as any[]
				}
			}
		}))
};

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig(VFS_TEST ? vfsTestConfig : defaultConfig);
