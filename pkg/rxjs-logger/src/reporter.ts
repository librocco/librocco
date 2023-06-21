import { LoggerInternal, Pipeline } from "./internal";
import { Logs } from "./types";

import { map, reduce, avg } from "./utils";

export class PipelineReporter {
	private _internal: Pipeline;

	constructor(pipeline: Pipeline) {
		this._internal = pipeline;
	}

	id = () => this._internal.id;

	/** Prints all of the transmissions logged for a given pipeline */
	transmissions = () => {
		// Create a map of { transmissionId => transmissionStats }
		const iterators = new Map(
			map(this._internal.transmissions(), ([transmissionId, transmission]) => [
				transmissionId,
				transmission.steps()[Symbol.iterator]()
			])
		);

		// Create a generator used to create a { stepId => { [transmissionId: string]: stepDuration } } map
		const mapGenerator = (function* () {
			while (true) {
				// Get values for all transmissions for a given step
				const [stepId, values] = reduce(
					iterators,
					(acc, [transmissionId, iterator]) => {
						const value = iterator.next().value as [string, Logs];

						if (!value) {
							return acc;
						}

						const [stepId, { timeDiff }] = value;
						const [, durations] = acc;

						return [stepId, { ...durations, [transmissionId]: timeDiff }];
					},
					["", {}] as [string, Record<string, number>]
				);

				// Step id will be defined if there's at least one transmission recorded with current step
				// i.e. if there's no step, we've iterated over all of the steps for all of the transmissions.
				if (!stepId) {
					break;
				}

				yield [stepId, values] as [string, Record<string, number>];
			}
		})();

		return new Map<string, { [transmissionId: string]: number }>(mapGenerator);
	};

	/** Prints the stats (steps and times for each respective step) for a given transmission in the pipeline */
	transmission = (transmissionId: string) => {
		const steps = this._internal.transmission(transmissionId).steps();
		return new Map<string, number>(map(steps, ([stepId, { timeDiff: took }]) => [stepId, took])).set(
			"Total",
			reduce(steps.values(), (acc, { timeDiff: took }) => acc + took, 0)
		);
	};

	stats(): Map<string, number> {
		return new Map(map(this.transmissions(), ([stepId, durations]) => [stepId, avg(Object.values(durations))]));
	}
}

export class LogReporter {
	private _internal: LoggerInternal;

	constructor(logger: LoggerInternal) {
		this._internal = logger;
	}

	/** Prints all of the pipelines for which we keep the logs */
	pipelines = () => this._internal.pipelines().keys();

	/** Access the reports for the given pipeline */
	pipeline = (pipelineId: string) => new PipelineReporter(this._internal.pipeline(pipelineId));
}

export const newLogReporter = (logger: LoggerInternal) => new LogReporter(logger);
