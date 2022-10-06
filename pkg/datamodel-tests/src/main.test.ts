import { describe } from 'vitest';

import { newTestRunner } from '@runner/runner';

import * as testDataLoader from '@loaders/couchdb-image-loader';

import * as implementations from './implementations';
import * as tests from './tests';

describe('Datamodel tests', async () => {
	const runner = await newTestRunner(testDataLoader);

	Object.entries(implementations).forEach(([name, config]) => {
		describe(name, () => {
			const setup = runner.setup(config);

			Object.entries(tests).forEach(([name, testFn]) => {
				setup.test(name, testFn);
			});
		});
	});
});
