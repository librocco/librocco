import { describe } from 'vitest';

import { VersionString } from '@/types';

import { newTestRunner } from '../runner';

import * as testDataLoader from '@data-loaders/fs-data-loader';

import { v1 as newDatabase } from '@/implementations';
import tests from './tests';

import { processTestName } from '@/utils/misc';

describe('Datamodel tests', async () => {
	// We're currently using the `testDataLoader` for unit tests,
	const runner = await newTestRunner(testDataLoader);

	// We're runnint smokte tests against the default implementation as we're testing the test runner itself
	// not the implementations.
	describe('Test runner smoke tests', () => {
		const defaultImplementation = { version: 'v1' as VersionString, newDatabase };
		const setup = runner.setup(defaultImplementation);

		Object.entries(tests).forEach(([name, testFn]) => {
			setup.test(processTestName(name), testFn);
		});
	});
});
