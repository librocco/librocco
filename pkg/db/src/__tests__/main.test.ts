import { describe } from 'vitest';

import { VersionString } from '@/types';

import { __withDocker__ } from '@test-runner/env';

import { newTestRunner } from '@test-runner/runner';

import * as couchdbImageLoader from '@data-loaders/couchdb-image-loader';
import * as fsDataLoader from '@data-loaders/fs-data-loader';

import * as implementations from '@/implementations';
import * as benchmarks from './benchmarks';
import * as tests from './tests';

import { processTestName, processVersionName } from '@/utils/misc';

const testDataLoader = __withDocker__ ? couchdbImageLoader : fsDataLoader;

describe('Datamodel tests', async () => {
	const runner = await newTestRunner(testDataLoader);

	Object.entries(implementations).forEach(([version, newDatabase]) => {
		describe(processVersionName(version), () => {
			const setup = runner.setup({ version: version as VersionString, newDatabase });

			// Run tests on regular tests as well as benchmarks, as we sometimes want to debug the benchmark tests and
			// this is easire than debugging when the tests are being ran 20+ times for benchmarks.
			Object.entries({ ...tests, ...benchmarks }).forEach(([name, testFn]) => {
				setup.test(processTestName(name), testFn);
			});
		});
	});
});
