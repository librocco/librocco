import { DateTime } from "luxon";

import { ValueWithMeta, Logs } from "./types";

export class Stream {
	#pipeline: Pipeline;

	id: string;

	private _sourceStream?: Stream;

	private steps: Logs[] = [];

	constructor(pipeline: Pipeline, id: string) {
		this.#pipeline = pipeline;
		this.id = id;

		// If the pipeline this stream belongs to is a fork, the source pipeline will have the
		// previous steps of the stream saved as a Stream with the same id as this one
		this._sourceStream = this.#pipeline.sourcePipeline()?.stream(this.id);
	}

	start<V extends ValueWithMeta>(valueWithMeta: V): V {
		const timestamp = DateTime.now();

		if (this.steps.length) {
			const startTime = this.steps[0].timestamp;
			const currentTime = timestamp;
			warn(`Trying to run 'stream.start' on an already started stream.\n`, { ...valueWithMeta, startTime, currentTime });
			return valueWithMeta;
		}

		const stepId = this._sourceStream ? "fork" : "start";

		this.steps = [
			{
				stepId,
				timestamp,
				timeDiff: 0,
				...valueWithMeta
			}
		];

		return valueWithMeta;
	}

	private getLastStep(): Logs | undefined {
		const numSteps = this.steps.length;
		return numSteps ? this.steps[numSteps - 1] : this._sourceStream?.getLastStep();
	}

	private getsourceSteps() {
		return this._sourceStream?.get() || [];
	}

	log<V extends ValueWithMeta>(valueWithMeta: V, stepId: string): V {
		const timestamp = DateTime.now();

		if (this.steps.length === 0) {
			const startTime = null;
			const currentTime = timestamp;
			warn(`Trying to write logs for a non existing stream: Did you forget to run 'stream.start()'?`, {
				...valueWithMeta,
				startTime,
				currentTime
			});
			return valueWithMeta;
		}

		// If there already are steps logged for this stream, get the latest (as previous step)
		// if not, we check if this stream belongs to a forked pipeline. If so, get the last step of the
		// root stream. Finally, resort to undefined.
		const prevStep = this.getLastStep();

		const timeDiff = prevStep ? timestamp.diff(prevStep.timestamp, "milliseconds").milliseconds : 0;

		this.steps.push({
			...valueWithMeta,
			stepId,
			timestamp,
			timeDiff
		});

		return valueWithMeta;
	}

	get(): Logs[] {
		return this.getsourceSteps().concat(this.steps);
	}
}

export class Pipeline {
	#logger: LoggerInternal;

	id: string;

	private _sourcePipeline?: Pipeline;
	private _forks = new Map<string, Pipeline>();

	private _streams = new Map<string, Stream>();

	constructor(logger: LoggerInternal, id: string, sourcePipeline?: Pipeline) {
		this.#logger = logger;

		this.id = id;

		// If this is a forked pipeline, keep the reference to the pipeline for lookups
		if (sourcePipeline) {
			this._sourcePipeline = sourcePipeline;
		}
	}

	stream = (streamId: string) => {
		if (!this._streams.has(streamId)) {
			this._streams.set(streamId, new Stream(this, streamId));
		}
		return this._streams.get(streamId) as Stream;
	};

	streams = () => this._streams.keys();

	sourcePipeline = () => this._sourcePipeline;

	fork = (forkId: string): Pipeline => {
		const forkedPipeline = this.#logger.pipeline(forkId, this);
		this._forks.set(forkId, forkedPipeline);
		return forkedPipeline;
	};

	forks = () => this._forks.keys();
}

/**
 * Internal logger instance:
 * - keeps record of registered pipelines and their corresponding streams
 * - exposes an API to store/retrieve the logs per pipeline/stream, etc
 */
export class LoggerInternal {
	private _pipelines = new Map<string, Pipeline>();

	pipeline = (pipelineId: string, srcPipeline?: Pipeline) => {
		if (!this._pipelines.has(pipelineId)) {
			this._pipelines.set(pipelineId, new Pipeline(this, pipelineId, srcPipeline));
		}
		return this._pipelines.get(pipelineId) as Pipeline;
	};

	pipelines = () => this._pipelines.keys();

	start = <V extends ValueWithMeta>(logs: V): V => {
		const { pipelineId, streamId } = logs;
		return this.pipeline(pipelineId).stream(streamId).start(logs);
	};

	log = <V extends ValueWithMeta>(meta: V, stepId: string): V => {
		const { pipelineId, streamId } = meta;
		return this.pipeline(pipelineId).stream(streamId).log(meta, stepId);
	};
}

const warn = (
	message: string,
	{
		pipelineId,
		streamId,
		startTime,
		currentTime
	}: { pipelineId: string; streamId: string; startTime: DateTime | null; currentTime: DateTime }
) => {
	console.warn(
		`${message}:\n`,
		`  Pipeline id: ${pipelineId}\n`,
		`  Stream id: ${streamId}\n`,
		`  Started at: ${startTime?.toISO() || "null"}\n`,
		`  Current time: ${currentTime.toISO()}`
	);
};
