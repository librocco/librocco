import { describe, expect, test } from "vitest";
import { bufferCount, firstValueFrom, interval, map, take } from "rxjs";

import { Logs } from "../types";

import { newLogger } from "../logger";

const logger = newLogger();
const { startStream, log } = logger;

describe("Logging", () => {
	test("should keep the logs for instrumented streams", async () => {
		const pipelineId = "pipeline-1";

		let streamIx = 0;

		const origin = interval(300).pipe(
			take(3),
			// We use 'startStream' transformer to mark the start of the new stream on a given pipeline
			startStream(pipelineId, () => (streamIx++).toString())
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

		// Explicitly check for logs for the first stream (starting with the value of 0)
		const stream0Logs = logger.pipeline(pipelineId).stream("0").get();
		expect(stream0Logs).toEqual([
			// Initial step (start of the pipeline)
			expect.objectContaining({
				pipelineId,
				streamId: "0",
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
				streamId: "0",
				stepId: "step_1",
				// First operator adds 1 to the value
				value: 1
			} as Logs),
			expect.objectContaining({
				pipelineId,
				streamId: "0",
				stepId: "step_2",
				// Second operator raises the value to the power of 2 (1^1=1)
				value: 1
			} as Logs),
			expect.objectContaining({
				pipelineId,
				streamId: "0",
				stepId: "step_3",
				// Third operator converts the value to string
				value: "1"
			} as Logs)
		]);

		// Check for the rest of the logs (streams "1" and "2")
		//
		// Initial values of stream "1" and "2" (the same value as stream id, only of type number)
		const initialValues = [1, 2];
		// Construct the "want" logs
		const [stream1Logs, stream2Logs] = initialValues.map((initialValue) => {
			// Stream "1" will have the initial value of 1, and so...
			const streamId = initialValue.toString();

			// First step adds 1 to the value
			const step1Value = initialValue + 1;
			// Second step raises the value to the power of 2
			const step2Value = step1Value * step1Value;
			// Third step converts the value to string
			const step3Value = step2Value.toString();

			return [initialValue, step1Value, step2Value, step3Value].map((value, i) =>
				expect.objectContaining({
					pipelineId,
					streamId,
					// First step is always "start", others are numbered with 1-based index
					stepId: i === 0 ? "start" : `step_${i}`,
					value
					// We're omitting 'timestamp' and 'timeDiff' as we can't control those values
				} as Logs)
			);
		});

		expect(logger.pipeline(pipelineId).stream("1").get()).toEqual(stream1Logs);
		expect(logger.pipeline(pipelineId).stream("2").get()).toEqual(stream2Logs);
	});
});
