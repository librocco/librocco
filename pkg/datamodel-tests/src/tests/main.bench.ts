import { describe } from 'vitest';

import { Test } from '@/types';

import { newTestRunner } from '@runner/runner';

import * as testDataLoader from '@loaders/couchdb-image-loader';

import * as implementations from '@tests/implementations';
import * as tests from '@tests/tests';

describe('Datamodel tests', async () => {
	// We're currently using the `testDataLoader` from unit tests,
	// but will switch it up with loader reading data from fs or an image
	const runner = await newTestRunner(testDataLoader);

	const setups = Object.entries(implementations).map(
		([name, config]) => [name, runner.newModel(config)] as [string, { test: Test; bench: Test }]
	);

	Object.entries(tests).forEach(([name, testFn]) => {
		describe(name, () => {
			setups.forEach(([implementation, setup]) => {
				setup.bench(implementation, testFn);
			});
		});
	});
});
