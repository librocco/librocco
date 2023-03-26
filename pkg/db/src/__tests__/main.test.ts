import { describe } from "vitest";

import { VersionString } from "@/types";

import { __withDocker__ } from "@test-runner/env";

import { newTestRunner } from "@test-runner/runner";

import * as couchdbImageLoader from "@data-loaders/couchdb-image-loader";
import * as fsDataLoader from "@data-loaders/fs-data-loader";

import * as implementations from "@/implementations";
import * as benchmarks from "./benchmarks";
import * as tests from "./tests";

import { currentVersion } from "@/currentVersion";

import { processTestName, processVersionName } from "@/utils/misc";

const testDataLoader = __withDocker__ ? couchdbImageLoader : fsDataLoader;

// Flag to only run tests on the current version
const mode = process.env.TEST_MODE || "all";

describe("Datamodel tests", async () => {
	const runner = await newTestRunner(testDataLoader);

	Object.entries(implementations)
		// If in 'all' mode (we're running tests on all versions) this is a no-op.
		// If running in 'current-version' mode, we only run tests on the current version.
		.filter(([version]) => mode !== "current-version" || version === currentVersion)
		.forEach(([version, newDatabase]) => {
			describe(processVersionName(version), () => {
				const setup = runner.setup({ version: version as VersionString, newDatabase });

				const testsToRun = Object.entries(tests);

				// If running with docker support, we want to run the benchmarks as well, as we sometimes want to debug
				// the benchmark tests and this is easier than debugging when the tests are being ran 20+ times for benchmarks.
				//
				// If we're not running with docker support, we're not running benchmark tests as they require notes loaded from container with test data/fixtures.
				if (__withDocker__) {
					// If we're running with docker, we want to run the benchmarks as well.
					testsToRun.push(...Object.entries(benchmarks));
				}

				testsToRun.forEach(([name, testFn]) => {
					setup.test(processTestName(name), testFn);
				});
			});
		});
});
