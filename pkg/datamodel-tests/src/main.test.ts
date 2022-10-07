import { describe } from 'vitest';

import { newTestRunner } from '@runner/runner';

import * as testDataLoader from '@loaders/couchdb-image-loader';

import * as implementations from './implementations';
import * as tests from './tests';

import { processTestName, processVersionName } from './utils/misc';

describe('Datamodel tests', async () => {
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
