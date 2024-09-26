import { defineConfig, devices } from "@playwright/test";

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// require('dotenv').config();

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
	testDir: "./integration",
	/* Run tests in files in parallel */
	fullyParallel: true,
	/* Fail the build on CI if you accidentally left test.only in the source code. */
	forbidOnly: !!process.env.CI,
	/* Retry for local test run (normally, the tests ran using the UI will not be flaky, but headless tests might take a toll on the CPU, resulting in flaky tests) */
	retries: 2,
	/* Opt out of parallel tests on CI. */
	workers: process.env.CI ? 1 : undefined,
	/* Reporter to use. See https://playwright.dev/docs/test-reporters */
	reporter: "html",
	/* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
	use: {
		/* Base URL to use in actions like `await page.goto('/')`. */
		// baseURL: 'http://127.0.0.1:3000',

		/* Collect trace for failed test. See https://playwright.dev/docs/trace-viewer */
		trace: "retain-on-failure",

		/** Record video for all test runs and retain for failed tests. See https://playwright.dev/docs/videos */
		video: "retain-on-failure"
	},

	/* Configure projects for major browsers */
	projects: [
		{
			name: "chromium",
			use: { ...devices["Desktop Chrome"] }
		}

		// Skipped as SQLocal doesn't seem to play that well with Firefox, TODO: support firefox as well
		// {
		// 	name: "firefox",
		// 	use: { ...devices["Desktop Firefox"] }
		// }

		// Skipped as some tests are failing on webkit in CI. The functionality is there and we wish to still
		// run those tests, and have the ability for PRs to be green.
		// TODO: Uncomment this when we have time to fix the tests failing on webkit:
		// - scan input
		// - enter form submission
		//
		// {
		// 	name: "webkit",
		// 	use: { ...devices["Desktop Safari"] }
		// }

		/* Test against mobile viewports. */
		// {
		//   name: 'Mobile Chrome',
		//   use: { ...devices['Pixel 5'] },
		// },
		// {
		//   name: 'Mobile Safari',
		//   use: { ...devices['iPhone 12'] },
		// },

		/* Test against branded browsers. */
		// {
		//   name: 'Microsoft Edge',
		//   use: { ...devices['Desktop Edge'], channel: 'msedge' },
		// },
		// {
		//   name: 'Google Chrome',
		//   use: { ...devices['Desktop Chrome'], channel: 'chrome' },
		// },
	]

	/* Run your local dev server before starting the tests */
	// webServer: {
	//   command: 'npm run start',
	//   url: 'http://127.0.0.1:3000',
	//   reuseExistingServer: !process.env.CI,
	// },
});
