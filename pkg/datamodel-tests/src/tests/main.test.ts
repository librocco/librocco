import { afterAll, describe } from 'vitest';
import { Bench } from 'tinybench';

import { newTestRunner } from '@runner/runner';

import * as testDataLoader from '@loaders/couchdb-image-loader';

import * as implementations from '@tests/implementations';
import * as tests from '@tests/tests';

describe('Datamodel tests', async () => {
	// We're currently using the `testDataLoader` from unit tests,
	// but will switch it up with loader reading data from fs or an image
	const runner = await newTestRunner(testDataLoader);

	Object.entries(implementations).forEach(([name, config]) => {
		describe(name, () => {
			const bench = new Bench();

			const setup = runner.newModel(config, bench);

			Object.entries(tests).forEach(([name, testFn]) => {
				setup.test(name, testFn);
			});

			afterAll(() => {
				printBenchmark(bench);
			});
		});
	});
});

const formatBenchResult = (r?: number): string | number => {
	if (!r) return 'N/A';
	return Math.trunc(r * 1000) / 1000;
};

const printBenchmark = (bench: Bench) => {
	console.table(
		bench.tasks.map(({ name, result }) => {
			return {
				'Task Name': name,
				'Average Time (s)': formatBenchResult(result?.mean),
				'Variance (s)': formatBenchResult(result?.variance)
			};
		})
	);
};
