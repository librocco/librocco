import { describe } from 'vitest';

import { newTestRunner } from '@runner/runner';

import * as testDataLoader from '@loaders/smoke-test-loader';

import * as datamodels from '@/tests/implementations';
import { addBooksToNote, commitNote, deleteNotes, explicitlySetVolumeStock } from '@/tests/tests';

// We're running unit tests on a subset of final, full tests (for different datamodels)
const tests = { addBooksToNote, commitNote, deleteNotes, explicitlySetVolumeStock };

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
