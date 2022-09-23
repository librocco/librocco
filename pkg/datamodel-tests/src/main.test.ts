import { describe } from 'vitest';

import { newTestRunner } from './runner/runner';
import * as testDataLoader from './runner/__tests__/testDataLoader';

import * as datamodels from './datamodels';

import * as tests from './tests';

describe('Datamodel tests', async () => {
	// We're currently using the `testDataLoader` from unit tests,
	// but will switch it up with loader reading data from fs or an image
	const runner = await newTestRunner(testDataLoader);

	Object.entries(datamodels).forEach(([name, config]) => {
		describe(name, () => {
			const setup = runner.newModel(config);

			Object.entries(tests).forEach(([name, testFn]) => {
				setup.test(name, testFn);
			});
		});
	});
});
