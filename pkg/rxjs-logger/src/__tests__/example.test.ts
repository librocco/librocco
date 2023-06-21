import { describe, expect, test } from "vitest";
import { of, bufferCount, combineLatest, firstValueFrom, from, map, ReplaySubject, share, filter, interval, take } from "rxjs";

import { Logs, ValueWithMeta } from "../types";

import { newLogger } from "../logger";

describe("Logging", () => {
	test("should keep the logs for instrumented transmissions", async () => {
		const logger = newLogger();

		const { start, log } = logger;

		const pipelineId = "pipeline-1";

		let transmissionIx = 0;

		const origin = from([0, 1, 2]).pipe(
			// We use 'start' transformer to mark the start of the new transmission on a given pipeline
			start(pipelineId, () => (transmissionIx++).toString())
		);

		const pipeline = origin.pipe(
			log(
				"step_1",
				map((a) => a + 1)
			),
			log(
				"step_2",
				map((a) => a * a)
			),
			log(
				"step_3",
				map((a) => a.toString())
			)
		);

		// Wait for the observable to complete
		await firstValueFrom(pipeline.pipe(bufferCount(3)));

		// Explicitly check for logs for the first transmission (starting with the value of 0)
		const transmission0Logs = [...logger.pipeline(pipelineId).transmission("0").steps().values()];
		expect(transmission0Logs).toEqual([
			// Initial step (start of the pipeline)
			expect.objectContaining({
				pipelineId,
				transmissionId: "0",
				// "start" is always the value of the first step
				stepId: "start",
				// Time diff should be 0 as it's the start of the pipeline
				took: 0,
				value: 0
			} as Logs),

			// We're omitting the timestamp and time diff from the rest of the steps
			// in the pipeline as we can't control them
			expect.objectContaining({
				pipelineId,
				transmissionId: "0",
				stepId: "step_1",
				// First operator adds 1 to the value
				value: 1
			} as Logs),
			expect.objectContaining({
				pipelineId,
				transmissionId: "0",
				stepId: "step_2",
				// Second operator raises the value to the power of 2 (1^1=1)
				value: 1
			} as Logs),
			expect.objectContaining({
				pipelineId,
				transmissionId: "0",
				stepId: "step_3",
				// Third operator converts the value to string
				value: "1"
			} as Logs)
		]);

		// Check for the rest of the logs (transmissions "1" and "2")
		//
		// Initial values of transmission "1" and "2" (the same value as transmission id, only of type number)
		const initialValues = [1, 2];
		// Construct the "want" logs
		const [transmission1Logs, transmission2Logs] = initialValues.map((initialValue) => {
			// transmission "1" will have the initial value of 1, and so...
			const transmissionId = initialValue.toString();

			// First step adds 1 to the value
			const step1Value = initialValue + 1;
			// Second step raises the value to the power of 2
			const step2Value = step1Value * step1Value;
			// Third step converts the value to string
			const step3Value = step2Value.toString();

			return [initialValue, step1Value, step2Value, step3Value].map((value, i) =>
				expect.objectContaining({
					pipelineId,
					transmissionId,
					// First step is always "start", others are numbered with 1-based index
					stepId: i === 0 ? "start" : `step_${i}`,
					value
					// We're omitting 'timestamp' and 'took' as we can't control those values
				} as Logs)
			);
		});

		expect([...logger.pipeline(pipelineId).transmission("1").steps().values()]).toEqual(transmission1Logs);
		expect([...logger.pipeline(pipelineId).transmission("2").steps().values()]).toEqual(transmission2Logs);
	});
});

describe("Forking of pipelines", () => {
	test("transmission should keep track of transmissions forked from itself", async () => {
		const logger = newLogger();

		const { start, log, fork } = logger;

		const origin = of(2);

		const connector = new ReplaySubject<ValueWithMeta<number>>(1);
		const pipeline1 = origin.pipe(
			// We're testing with only one transmission, so it's safe to hardcode the name
			start("pipeline-1", () => "transmission-1"),
			log(
				"step_1.1",
				map((value) => value + 1)
			),
			share({ connector: () => connector })
		);

		const pipeline2 = pipeline1.pipe(
			fork("pipeline-2"),
			log(
				"step_2.1",
				// Maps the value from origin to 9
				map((value) => value * value)
			)
		);

		const pipeline3 = pipeline1.pipe(
			fork("pipeline-3"),
			log(
				"step_3.1",
				// Maps the value from origin to "value: 3"
				map((value) => `value: ${value}`)
			)
		);

		// Wait for both (fork) transmissions to finish
		await firstValueFrom(combineLatest([pipeline2, pipeline3]));

		// Transmisison 1 should keep track of forks
		const srcTransmission = logger.pipeline("pipeline-1").transmission("transmission-1");
		const fork1 = logger.pipeline("pipeline-2").transmission("transmission-1");
		const fork2 = logger.pipeline("pipeline-3").transmission("transmission-1");

		// Object representation of 'forks' map we're expecting from transmission 1
		const wantForks = {
			// Forks are keyed by their respective pipeline, with value being reference to transmission object
			"pipeline-2": fork1,
			"pipeline-3": fork2
		};

		expect(Object.fromEntries(srcTransmission.forks())).toEqual(wantForks);

		// Fork transmissions should keep track of their source transmission
		expect([...fork1.sources()]).toEqual([["pipeline-1", srcTransmission]]);
		expect([...fork2.sources()]).toEqual([["pipeline-1", srcTransmission]]);
	});

	test("pipeline should be able to calculate all of the forks from the pipeline (even if not all transmissions are forked)", async () => {
		const logger = newLogger();

		const { start, log, fork } = logger;

		let transmissionIx = 0;

		const origin = from([0, 1]);

		const connector = new ReplaySubject<ValueWithMeta<number>>(1);
		const pipeline1 = origin.pipe(
			start("pipeline-1", () => (transmissionIx++).toString()),
			share({ connector: () => connector })
		);

		const onlyEven = pipeline1.pipe(filter(({ value }) => value % 2 === 0));

		// Pipeline 2 forks the pipeline 1 only in case of even numbers
		const pipeline2 = onlyEven.pipe(
			fork("pipeline-2"),
			log(
				"step_2.1",
				map((value) => value * value)
			)
		);

		// Pipeline 3 forks the pipeline 1 regardless of the value
		const pipeline3 = pipeline1.pipe(
			fork("pipeline-3"),
			log(
				"step_3.1",
				map((value) => `value: ${value}`)
			)
		);

		// Wait for both pipelines to process the transmissions
		await firstValueFrom(
			combineLatest([
				// Pipeline 2 will process only one transmission
				pipeline2,
				// Wa want to wait for pipeline 3 to process both transmissions
				pipeline3.pipe(bufferCount(2))
			])
		);

		// Pipeline 1 should recognize both pipeline 2 and 3 as forks, even though pipeline 2 forks
		// only some transmissions. Furthermore, forks should not repeat.
		const wantForks = ["pipeline-2", "pipeline-3"].map((pipelineId) => [pipelineId, logger.pipeline(pipelineId)]);
		// Pipelines won't be sorted in predictable order, so we're ordering them (by id) in ascending lexical order for comparison
		const forks = [...logger.pipeline("pipeline-1").forks()].sort(([a], [b]) => (a > b ? 1 : -1));
		expect(forks).toEqual(wantForks);
	});
});

describe("Joining", () => {
	test("should keep track of transmissions affecting the value in case of pipeline joins (e.g. 'combineLatest')", async () => {
		const logger = newLogger();
		const { start, join } = logger;

		const intervalObs = interval(50).pipe(take(4));

		// We're creating two pipelines, one with even numbers, one with odd numbers emitting alternately every 50ms
		const even = intervalObs.pipe(
			start("even", (value) => value.toString()),
			filter(({ value }) => value % 2 === 0)
		);
		const odd = intervalObs.pipe(
			start("odd", (value) => value.toString()),
			filter(({ value }) => value % 2 === 1)
		);

		// Our pipeline tracks both and joins them in a single pipeline transmitting tuples of [even, odd]
		const joined = combineLatest([even, odd]).pipe(join("joined"));

		// Combine latest will wait for both of the source pipelines to transmit a value before transmitting further,
		// leaving us with 3 values ([0, 1], [2, 3], [2, 3])
		await firstValueFrom(joined.pipe(bufferCount(3)));

		// We're expecting 3 transmissions:
		// 1. triggered by transmission of the value 1 from the 'odd' pipeline
		// 2. triggered by transmission of the value 2 from the 'even' pipeline
		// 3. triggered by transmission of the value 3 from the 'odd' pipeline
		// All transmissions should have the same id as their triggering source transmission and keep references to all source transmissions
		//
		// We're checking transmissions by matching a 'want' array containing [transmissionId, ...[sourcePipeline, sourceTransmission][]]
		const transmission0 = logger.pipeline("even").transmission("0");
		const transmission1 = logger.pipeline("odd").transmission("1");
		const transmission2 = logger.pipeline("even").transmission("2");
		const transmission3 = logger.pipeline("odd").transmission("3");
		const wantTransmissions = [
			["1", ["even", transmission0], ["odd", transmission1]],
			["2", ["even", transmission2], ["odd", transmission1]],
			["3", ["even", transmission2], ["odd", transmission3]]
		];
		const transmissions = [...logger.pipeline("joined").transmissions()].map(([transmissionId, transmission]) => [
			transmissionId,
			...transmission.sources()
		]);

		expect(transmissions).toEqual(wantTransmissions);
	});

	test("pipeline should be able to calculate all the source pipelines in case of joins (e.g. combineLatest)", async () => {
		const logger = newLogger();
		const { start, join } = logger;

		const intervalObs = interval(50).pipe(take(4));

		// We're creating two pipelines, one with even numbers, one with odd numbers emitting alternately every 50ms
		const even = intervalObs.pipe(
			start("even", (value) => value.toString()),
			filter(({ value }) => value % 2 === 0)
		);
		const odd = intervalObs.pipe(
			start("odd", (value) => value.toString()),
			filter(({ value }) => value % 2 === 1)
		);

		// Our pipeline tracks both and joins them in a single pipeline transmitting tuples of [even, odd]
		const joined = combineLatest([even, odd]).pipe(join("joined"));

		// Combine latest will wait for both of the source pipelines to transmit a value before transmitting further,
		// leaving us with 3 values ([0, 1], [2, 3], [2, 3])
		await firstValueFrom(joined.pipe(bufferCount(3)));

		const evenPipeline = logger.pipeline("even");
		const oddPipeline = logger.pipeline("odd");
		const wantSourcePipelines = [
			["even", evenPipeline],
			["odd", oddPipeline]
		];
		// Pipelines won't be sorted in predictable order, so we're ordering them (by id) in ascending lexical order for comparison
		const sourcePipelines = [...logger.pipeline("joined").sources()].sort(([a], [b]) => (a > b ? 1 : -1));

		expect(sourcePipelines).toEqual(wantSourcePipelines);
	});
});
