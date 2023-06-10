import { DateTime } from "luxon";
import { map, Observable, OperatorFunction, tap } from "rxjs";

import { ValueWithMeta, Logs, LogsMeta } from "./types";

class Stream {
	id: string;
	steps: Logs[] = [];

	constructor(id: string) {
		this.id = id;
	}

	log(valueWithMeta: ValueWithMeta, stepId?: string) {
		const timestamp = DateTime.now();

		const stepIx = this.steps.length;

		const prevStep = this.steps[stepIx - 1];

		const timeDiff = prevStep ? timestamp.diff(prevStep.timestamp, "milliseconds").milliseconds : 0;

		this.steps.push({
			...valueWithMeta,
			// First step will always be "start"
			stepId: stepIx === 0 ? "start" : stepId || stepIx.toString(),
			timestamp,
			timeDiff
		});
	}

	get() {
		return this.steps;
	}
}

class Pipeline {
	id: string;
	streams = new Map<string, Stream>();

	constructor(id: string) {
		this.id = id;
	}

	stream(streamId: string) {
		if (!this.streams.has(streamId)) {
			this.streams.set(streamId, new Stream(streamId));
		}
		return this.streams.get(streamId) as Stream;
	}
}

class Logger {
	_pipelines = new Map<string, Pipeline>();

	pipeline(pipelineId: string) {
		if (!this._pipelines.has(pipelineId)) {
			this._pipelines.set(pipelineId, new Pipeline(pipelineId));
		}
		return this._pipelines.get(pipelineId) as Pipeline;
	}

	log(meta: ValueWithMeta, stepId?: string) {
		const { pipelineId, streamId } = meta;
		this.pipeline(pipelineId).stream(streamId).log(meta, stepId);
	}
}

export const newLogger = () => {
	const logger = new Logger();

	const startStream =
		<V>(pipelineId: string, streamId: (value: V) => string) =>
		(input: Observable<V>): Observable<ValueWithMeta<V>> =>
			map((value) => {
				const id = streamId(value as V);
				const valueWithMeta = { pipelineId, streamId: id, value } as ValueWithMeta<V>;
				logger.log(valueWithMeta);
				return valueWithMeta;
			})(input);

	const log =
		<V, R>(
			stepId: string,
			transformer: OperatorFunction<V, R>
		): ((input: Observable<ValueWithMeta<V>>) => Observable<ValueWithMeta<R>>) =>
		(input) => {
			let meta: LogsMeta;
			return (input as Observable<ValueWithMeta>).pipe(
				// Tap into the value with meta, storing the meta to the outer scope
				tap(({ streamId, pipelineId }) => {
					meta = { streamId, pipelineId };
				}),
				// Unwrap the value from the value with meta
				map(({ value }) => value),
				// Run the transformer with the value
				transformer,
				// Wrap the value with meta back up
				map((value) => ({ value, ...meta } as ValueWithMeta<R>)),
				// Log the (transformed) value with meta
				tap((valueWithMeta) => {
					logger.log(valueWithMeta, stepId);
				})
			);
		};

	return { logger, log, startStream };
};
