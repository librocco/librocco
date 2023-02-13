import { describe } from 'vitest';

import { utils } from '@librocco/db';

import { newTestRunner } from '@runner/runner';

import * as testDataLoader from '@loaders/couchdb-image-loader';

import * as implementations from './implementations';
import * as tests from './benchmarks';

const { processTestName, processVersionName } = utils;

describe('Datamodel benchmarks', async () => {
	const runner = await newTestRunner(testDataLoader);

	Object.entries(tests).forEach(([name, testFn]) => {
		describe(processTestName(name), () => {
			Object.entries(implementations).forEach(([versionName, config]) => {
				// Setup is actually quite cheap (no async operations) and idempotent,
				// so we can afford to do it per test basis
				runner.setup(config).bench(processVersionName(versionName), testFn);
			});
		});
	});
});
