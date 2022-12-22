import { describe } from 'vitest';

import { __withDocker__ } from './runner/env';

import { newTestRunner } from '@runner/runner';

import * as couchdbImageLoader from '@loaders/couchdb-image-loader';
import * as fsDataLoader from '@loaders/fs-data-loader';

import * as implementations from './implementations';
import * as tests from './tests';

import { processTestName, processVersionName } from './utils/misc';

const testDataLoader = __withDocker__ ? couchdbImageLoader : fsDataLoader;

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