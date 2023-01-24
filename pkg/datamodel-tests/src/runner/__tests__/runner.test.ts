import { describe } from 'vitest';

import { newTestRunner } from '@runner/runner';

import * as testDataLoader from '@loaders/fs-data-loader';

import * as implementations from '@/implementations';
import tests from './tests';

import { processTestName, processVersionName } from '@/utils/misc';

describe('Datamodel tests', async () => {
	// We're currently using the `testDataLoader` from unit tests,
	// but will switch it up with loader reading data from fs or an image
	const runner = await newTestRunner(testDataLoader);

	Object.entries(implementations).forEach(([versionName, config]) => {
		describe(processVersionName(versionName), () => {
			const setup = runner.setup(config);

			Object.entries(tests).forEach(([name, testFn]) => {
				setup.test(processTestName(name), testFn);
			});
		});
	});
});
