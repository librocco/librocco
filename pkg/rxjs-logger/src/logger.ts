import { map, Observable, OperatorFunction, tap } from "rxjs";

import { LogsMeta, ValueWithMeta } from "./types";

import { LoggerInternal, Pipeline, Stream } from "./internal";

class Logger {
	private _internal = new LoggerInternal();

	startStream =
		<V>(pipelineId: string, generateId: (value: V) => string) =>
		(input: Observable<V>): Observable<ValueWithMeta<V>> =>
			map((value) => {
				const streamId = generateId(value as V);
				const valueWithMeta = { pipelineId, streamId, value } as ValueWithMeta<V>;
				this._internal.log(valueWithMeta);
				return valueWithMeta;
			})(input);

	log =
		<V, R>(stepId: string, transformer: OperatorFunction<V, R>): OperatorFunction<ValueWithMeta<V>, ValueWithMeta<R>> =>
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
					this._internal.log(valueWithMeta, stepId);
				})
			);
		};

	// Expose 'pipeline' and 'pipelines' methods of the internal logger instance
	pipeline = this._internal.pipeline;
	pipelines = this._internal.pipelines;
}

export const newLogger = () => new Logger();
