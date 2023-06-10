import { DateTime } from "luxon";

import { ValueWithMeta, Logs } from "./types";

export class Stream {
	id: string;
	private steps: Logs[] = [];

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

export class Pipeline {
	id: string;
	private _streams = new Map<string, Stream>();

	constructor(id: string) {
		this.id = id;
	}

	stream = (streamId: string) => {
		if (!this._streams.has(streamId)) {
			this._streams.set(streamId, new Stream(streamId));
		}
		return this._streams.get(streamId) as Stream;
	};

	streams = () => this._streams.keys();
}

/**
 * Internal logger instance:
 * - keeps record of registered pipelines and their corresponding streams
 * - exposes an API to store/retrieve the logs per pipeline/stream, etc
 */
export class LoggerInternal {
	private _pipelines = new Map<string, Pipeline>();

	pipeline = (pipelineId: string) => {
		if (!this._pipelines.has(pipelineId)) {
			this._pipelines.set(pipelineId, new Pipeline(pipelineId));
		}
		return this._pipelines.get(pipelineId) as Pipeline;
	};

	pipelines = () => this._pipelines.keys();

	log = (meta: ValueWithMeta, stepId?: string) => {
		const { pipelineId, streamId } = meta;
		this.pipeline(pipelineId).stream(streamId).log(meta, stepId);
	};
}
