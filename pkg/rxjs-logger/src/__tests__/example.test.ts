import { describe, expect, test } from "vitest";
import { bufferCount, combineLatest, firstValueFrom, interval, map, ReplaySubject, share, take } from "rxjs";

import { Logs, ValueWithMeta } from "../types";

import { newLogger } from "../logger";

describe("Logging", () => {
	test("should keep the logs for instrumented transmissions", async () => {
		const logger = newLogger();

		const { start, log } = logger;

		const pipelineId = "pipeline-1";

		let transmissionIx = 0;

		const origin = interval(100).pipe(
			take(3),
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
				timeDiff: 0,
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
					// We're omitting 'timestamp' and 'timeDiff' as we can't control those values
				} as Logs)
			);
		});

		expect([...logger.pipeline(pipelineId).transmission("1").steps().values()]).toEqual(transmission1Logs);
		expect([...logger.pipeline(pipelineId).transmission("2").steps().values()]).toEqual(transmission2Logs);
	});

	test("should keep track of forked pipelines", async () => {
		const logger = newLogger();

		const { start, log, fork } = logger;

		let transmissionIx = 0;

		const origin = interval(100).pipe(take(2));

		const connector = new ReplaySubject<ValueWithMeta<number>>(1);
		const pipeline1 = origin.pipe(
			start("pipeline-1", () => (transmissionIx++).toString()),
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
				map((value) => value * value)
			)
		);

		const pipeline3 = pipeline1.pipe(
			fork("pipeline-3"),
			log(
				"step_3.1",
				map((value) => `value: ${value}`)
			)
		);

		// Wait for both pipelines to process two transmissions
		await firstValueFrom(combineLatest([pipeline2.pipe(bufferCount(2)), pipeline3.pipe(bufferCount(2))]));

		// Pipeline 1 should keep track of forked pipelines
		const forks = [...logger.pipeline("pipeline-1").forks()];
		expect(forks).toEqual(["pipeline-2", "pipeline-3"]);

		// Pipeline 1 transmissions should only contains logs for the steps in pipeline 1
		const wantPipeline1Logs = [
			// First transmission
			[
				expect.objectContaining({ pipelineId: "pipeline-1", transmissionId: "0", stepId: "start", value: 0 }),
				expect.objectContaining({
					pipelineId: "pipeline-1",
					transmissionId: "0",
					stepId: "step_1.1",
					value: 1
				})
			],
			// Second transmission
			[
				expect.objectContaining({ pipelineId: "pipeline-1", transmissionId: "1", stepId: "start", value: 1 }),
				expect.objectContaining({
					pipelineId: "pipeline-1",
					transmissionId: "1",
					stepId: "step_1.1",
					value: 2
				})
			]
		];

		const pipeline1Logs = [...logger.pipeline("pipeline-1").transmissions().values()].map((transmission) => [
			...transmission.steps().values()
		]);

		expect(pipeline1Logs).toEqual(wantPipeline1Logs);

		// Logs for pipeline 2 and 3 should also contain the pipeline-1 logs
		const wantPipeline2Logs = [
			[
				...pipeline1Logs[0],
				expect.objectContaining({
					pipelineId: "pipeline-2",
					transmissionId: "0",
					stepId: "fork",
					value: 1
				}),
				expect.objectContaining({
					pipelineId: "pipeline-2",
					transmissionId: "0",
					stepId: "step_2.1",
					value: 1
				})
			],
			[
				...pipeline1Logs[1],
				expect.objectContaining({
					pipelineId: "pipeline-2",
					transmissionId: "1",
					stepId: "fork",
					value: 2
				}),
				expect.objectContaining({
					pipelineId: "pipeline-2",
					transmissionId: "1",
					stepId: "step_2.1",
					value: 4
				})
			]
		];
		const pipeline2Logs = [...logger.pipeline("pipeline-2").transmissions().values()].map((transmission) => [
			...transmission.steps().values()
		]);
		expect(pipeline2Logs).toEqual(wantPipeline2Logs);

		const wantPipeline3Logs = [
			[
				...pipeline1Logs[0],
				expect.objectContaining({
					pipelineId: "pipeline-3",
					transmissionId: "0",
					stepId: "fork",
					value: 1
				}),
				expect.objectContaining({
					pipelineId: "pipeline-3",
					transmissionId: "0",
					stepId: "step_3.1",
					value: "value: 1"
				})
			],
			[
				...pipeline1Logs[1],
				expect.objectContaining({
					pipelineId: "pipeline-3",
					transmissionId: "1",
					stepId: "fork",
					value: 2
				}),
				expect.objectContaining({
					pipelineId: "pipeline-3",
					transmissionId: "1",
					stepId: "step_3.1",
					value: "value: 2"
				})
			]
		];
		const pipeline3Logs = [...logger.pipeline("pipeline-3").transmissions().values()].map((transmission) => [
			...transmission.steps().values()
		]);
		expect(pipeline3Logs).toEqual(wantPipeline3Logs);
	});
});
