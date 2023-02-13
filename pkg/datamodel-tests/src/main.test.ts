import { describe } from 'vitest';

import { utils } from '@librocco/db';

import { __withDocker__ } from './runner/env';

import { newTestRunner } from '@runner/runner';

import * as couchdbImageLoader from '@loaders/couchdb-image-loader';
import * as fsDataLoader from '@loaders/fs-data-loader';

import * as implementations from './implementations';
import * as benchmarks from './benchmarks';
import * as tests from './tests';

const { processTestName, processVersionName } = utils;

const testDataLoader = __withDocker__ ? couchdbImageLoader : fsDataLoader;

describe('Datamodel tests', async () => {
	const runner = await newTestRunner(testDataLoader);

	Object.entries(implementations).forEach(([versionName, config]) => {
		describe(processVersionName(versionName), () => {
			const setup = runner.setup(config);

			// Run tests on regular tests as well as benchmarks, as we sometimes want to debug the benchmark tests and
			// this is easire than debugging when the tests are being ran 20+ times for benchmarks.
			Object.entries({ ...tests, ...benchmarks }).forEach(([name, testFn]) => {
				setup.test(processTestName(name), testFn);
			});
		});
	});
});
