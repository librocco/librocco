import { map, OperatorFunction, tap } from "rxjs";

import { LogsMeta, ValueWithMeta } from "./types";

import { LoggerInternal } from "./internal";
import { registerClient } from "./client";
import { unwrap, wrap } from "./operators";
import { DateTime } from "luxon";
import { shouldLog } from "./utils";

type ValueWithMetaTuple<A> = {
	[K in keyof A]: ValueWithMeta<A[K]>;
};

const timestampId = () => Date.now().toString();

export class Logger {
	private _internal = new LoggerInternal();

	getLogger = () => this._internal;

	start =
		<V>(pipelineId: string, generateId: (value: V) => string = timestampId): OperatorFunction<V, ValueWithMeta<V>> =>
		(input) =>
			input.pipe(
				map((value) => {
					const transmissionId = generateId(value);
					const res = this._internal.start({ pipelineId, transmissionId, value });
					return res;
				})
			);

	private _log =
		<V, R>(stepId: string, transformer: OperatorFunction<V, R>, doLog: boolean): OperatorFunction<ValueWithMeta<V>, ValueWithMeta<R>> =>
		(input) => {
			let meta = {} as LogsMeta;
			let start: DateTime;
			return input.pipe(
				// Tap into the value with meta, storing the meta to the outer scope
				tap(({ transmissionId, pipelineId }) => {
					meta = { transmissionId, pipelineId };
					start = DateTime.now();
				}),
				// Unwrap the value from the value with meta
				unwrap(),
				// Run the transformer with the value
				transformer,
				// Wrap the value with meta back up
				wrap(() => meta),
				// Log the (transformed) value with meta
				tap((valueWithMeta) => {
					if (!doLog) {
						return;
					}
					// Don't log if the pipelineId or transmissionId is missing
					// (to allow for empty values as defaults, but not produce incomplete logs)
					if (!shouldLog(valueWithMeta)) {
						return;
					}
					const took = DateTime.now().diff(start, "milliseconds").milliseconds;
					this._internal.log(valueWithMeta, stepId, took);
				})
			);
		};

	log = <V, R>(stepId: string, transformer: OperatorFunction<V, R>) => this._log(stepId, transformer, true);
	logOnce = <V, R>(stepId: string, transformer: OperatorFunction<V, R>) => {
		let logged = false;
		if (logged) {
			return this._log(stepId, transformer, false);
		}
		logged = true;
		return this._log(stepId, transformer, true);
	};
	logSkip = <V, R>(stepId: string, transformer: OperatorFunction<V, R>) => this._log(stepId, transformer, false);

	fork =
		<V>(newPipelineId: string): OperatorFunction<ValueWithMeta<V>, ValueWithMeta<V>> =>
		(input) =>
			input.pipe(
				map((valueWithMeta) => {
					// Don't log if the pipelineId or transmissionId is missing
					// (to allow for empty values as defaults, but not produce incomplete logs)
					if (!shouldLog(valueWithMeta)) {
						return valueWithMeta;
					}
					const { pipelineId: sourcePipeline, transmissionId, value } = valueWithMeta;
					return this.pipeline(sourcePipeline).transmission(transmissionId).newFork(this.pipeline(newPipelineId)).start(value);
				})
			);

	join = <A extends readonly unknown[]>(pipelineId: string): OperatorFunction<[...ValueWithMetaTuple<A>], ValueWithMeta<A>> => {
		return (input) =>
			input.pipe(
				map((inputs) => {
					// If any of the source's metadata is not defined, join without logging
					// (merely unwrap the values)
					if (!inputs.every((valueWithMeta) => shouldLog(valueWithMeta))) {
						return {
							value: inputs.map(({ value }) => value)
						};
					}
					// Get all source transmissions
					const sources = inputs.map(({ pipelineId, transmissionId }) =>
						// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
						this.pipeline(pipelineId!).transmission(transmissionId!)
					);

					// Find the id of the latest transmission from joined pipelines
					const { id } = sources.reduce((acc, curr) => {
						const accTimestamp = acc.getLastStep()?.timestamp?.toMillis() || 0;
						const currTimestamp = curr.getLastStep()?.timestamp?.toMillis() || 0;
						return accTimestamp > currTimestamp ? acc : curr;
					});

					// Combine the values from all the joined transmissions
					const value = inputs.map(({ value }) => value);

					// Create a new transmission with the same id as the latest transmission from joined pipelines,
					// marking all the joined transmissions as sources
					const transmission = this.pipeline(pipelineId).transmission(id, sources);

					// Mark the new transmission as a fork for each of the joined transmissions
					sources.forEach((source) => source.addFork(transmission));

					// Mark the start of the new transmission
					return transmission.start(value as unknown) as any;
				})
			);
	};

	registerClient = () => registerClient(this._internal);

	// Expose 'pipeline' and 'pipelines' methods of the internal logger instance
	pipeline = this._internal.pipeline;
	pipelines = this._internal.pipelines;
}

export const newLogger = () => new Logger();
