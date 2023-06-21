import { map, OperatorFunction, tap } from "rxjs";

import { LogsMeta, ValueWithMeta } from "./types";

import { LoggerInternal } from "./internal";
import { registerClient } from "./client";
import { unwrap, wrap } from "./operators";
import { DateTime } from "luxon";

const timestampId = () => Date.now().toString();

class Logger {
	private _internal = new LoggerInternal();

	constructor() {
		this.join = this.join.bind(this);
	}

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

	logOnce = <V, R>(stepId: string, transformer: OperatorFunction<V, R>): OperatorFunction<ValueWithMeta<V>, ValueWithMeta<R>> => {
		let logged = false;

		return (input) => {
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
				// Log the (transformed) value with meta only on first transmission
				tap((valueWithMeta) => {
					if (logged) {
						return;
					}
					const took = DateTime.now().diff(start, "milliseconds").milliseconds;
					this._internal.log(valueWithMeta, stepId, took);
					logged = true;
				})
			);
		};
	};

	log =
		<V, R>(stepId: string, transformer: OperatorFunction<V, R>): OperatorFunction<ValueWithMeta<V>, ValueWithMeta<R>> =>
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
					const took = DateTime.now().diff(start, "milliseconds").milliseconds;
					this._internal.log(valueWithMeta, stepId, took);
				})
			);
		};

	fork =
		<V extends ValueWithMeta>(newPipelineId: string): OperatorFunction<V, V> =>
		(input) =>
			input.pipe(
				map(
					({ pipelineId: sourcePipeline, transmissionId, value }) =>
						this.pipeline(sourcePipeline)
							.transmission(transmissionId)
							.newFork(this.pipeline(newPipelineId))
							.start({ pipelineId: newPipelineId, transmissionId, value }) as V
				)
			);

	join<A, B>(pipelineId: string): OperatorFunction<[ValueWithMeta<A>, ValueWithMeta<B>], ValueWithMeta<[A, B]>>;
	join<A, B, C>(pipelineId: string): OperatorFunction<[ValueWithMeta<A>, ValueWithMeta<B>, ValueWithMeta<C>], ValueWithMeta<[A, B, C]>>;
	join<A, B, C, D>(
		pipelineId: string
	): OperatorFunction<[ValueWithMeta<A>, ValueWithMeta<B>, ValueWithMeta<C>, ValueWithMeta<D>], ValueWithMeta<[A, B, C, D]>>;
	join<A, B, C, D, E>(
		pipelineId: string
	): OperatorFunction<
		[ValueWithMeta<A>, ValueWithMeta<B>, ValueWithMeta<C>, ValueWithMeta<D>, ValueWithMeta<E>],
		ValueWithMeta<[A, B, C, D, E]>
	>;
	join<A, B, C, D, E, F>(
		pipelineId: string
	): OperatorFunction<
		[ValueWithMeta<A>, ValueWithMeta<B>, ValueWithMeta<C>, ValueWithMeta<D>, ValueWithMeta<E>, ValueWithMeta<F>],
		ValueWithMeta<[A, B, C, D, E, F]>
	>;
	join(pipelineId: string): OperatorFunction<ValueWithMeta[], ValueWithMeta> {
		return (input) =>
			input.pipe(
				map((inputs) => {
					// Get all source transmissions
					const sources = inputs.map(({ pipelineId, transmissionId }) => this.pipeline(pipelineId).transmission(transmissionId));

					// Find the id of the latest transmission from joined pipelines
					const { id } = sources.reduce((acc, curr) => {
						const accTimestamp = acc.getLastStep()?.timestamp?.toMillis() || 0;
						const currTimestamp = curr.getLastStep()?.timestamp?.toMillis() || 0;
						return accTimestamp > currTimestamp ? acc : curr;
					});

					// Combine the values from all the joined transmissions
					const value = inputs.flatMap(({ value }) => [value]);

					// Create a new transmission with the same id as the latest transmission from joined pipelines,
					// marking all the joined transmissions as sources
					const transmission = this.pipeline(pipelineId).transmission(id, sources);

					// Mark the new transmission as a fork for each of the joined transmissions
					sources.forEach((source) => source.addFork(transmission));

					// Mark the start of the new transmission
					return transmission.start(value);
				})
			);
	}

	registerClient = () => registerClient(this._internal);

	// Expose 'pipeline' and 'pipelines' methods of the internal logger instance
	pipeline = this._internal.pipeline;
	pipelines = this._internal.pipelines;
}

export const newLogger = () => new Logger();
