import { describe } from 'vitest';

import { VersionString } from '@/types';

import { newTestRunner } from '@test-runner/runner';

import * as testDataLoader from '@data-loaders/couchdb-image-loader';

import * as implementations from '@/implementations';
import * as tests from './benchmarks';

import { processTestName, processVersionName } from '@/utils/misc';

describe('Datamodel benchmarks', async () => {
	const runner = await newTestRunner(testDataLoader);

	Object.entries(tests).forEach(([name, testFn]) => {
		describe(processTestName(name), () => {
			Object.entries(implementations).forEach(([version, newDatabase]) => {
				// Setup is actually quite cheap (no async operations) and idempotent,
				// so we can afford to do it per test basis
				runner.setup({ version: version as VersionString, newDatabase }).bench(processVersionName(version), testFn);
			});
		});
	});
});
