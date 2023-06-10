import { map, OperatorFunction, tap } from "rxjs";

import { LogsMeta, ValueWithMeta } from "./types";

import { LoggerInternal } from "./internal";

class Logger {
	private _internal = new LoggerInternal();

	start =
		<V>(pipelineId: string, generateId: (value: V) => string): OperatorFunction<V, ValueWithMeta<V>> =>
		(input) =>
			input.pipe(
				map((value) => {
					const transmissionId = generateId(value as V);
					return this._internal.start({ pipelineId, transmissionId, value });
				})
			);

	log =
		<V, R>(stepId: string, transformer: OperatorFunction<V, R>): OperatorFunction<ValueWithMeta<V>, ValueWithMeta<R>> =>
		(input) => {
			let meta: LogsMeta;
			return input.pipe(
				// Tap into the value with meta, storing the meta to the outer scope
				tap(({ transmissionId, pipelineId }) => {
					meta = { transmissionId, pipelineId };
				}),
				// Unwrap the value from the value with meta
				map(({ value }) => value),
				// Run the transformer with the value
				transformer,
				// Wrap the value with meta back up
				map((value) => ({ value, ...meta } as ValueWithMeta<R>)),
				// Log the (transformed) value with meta
				tap((valueWithMeta) => {
					this._internal.log(valueWithMeta, stepId);
				})
			);
		};

	fork =
		<V extends ValueWithMeta>(forkId: string): OperatorFunction<V, V> =>
		(input) =>
			input.pipe(
				map(
					({ pipelineId: sourceId, transmissionId, value }) =>
						this.pipeline(sourceId)
							.fork(forkId)
							.transmission(transmissionId)
							.start({ pipelineId: forkId, value, transmissionId }) as V
				)
			);

	// Expose 'pipeline' and 'pipelines' methods of the internal logger instance
	pipeline = this._internal.pipeline;
	pipelines = this._internal.pipelines;
}
10;
export const newLogger = () => new Logger();
