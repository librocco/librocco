import { describe } from 'vitest';

import { newTestRunner } from '@runner/runner';

import * as testDataLoader from './test-data-loader';

import * as datamodels from '@/implementations';
import tests from './tests';

describe('Datamodel tests', async () => {
	// We're currently using the `testDataLoader` from unit tests,
	// but will switch it up with loader reading data from fs or an image
	const runner = await newTestRunner(testDataLoader);

	Object.entries(datamodels).forEach(([name, config]) => {
		describe(name, () => {
			const setup = runner.setup(config);

			Object.entries(tests).forEach(([name, testFn]) => {
				setup.test(name, testFn);
			});
		});
	});
});
