import { LoggerInternal, Pipeline } from "./internal";

declare global {
	const window: any;
}

class PipelinePrinter {
	private _internal: Pipeline;

	constructor(pipeline: Pipeline) {
		this._internal = pipeline;
	}

	transmissions = () => {
		console.group(`Pipeline "${this._internal.id}" transmissions:`);
		for (const transmissionId of this._internal.transmissions()) {
			console.log(transmissionId);
		}
		console.groupEnd();
	};

	transmission = (transmissionId: string) => {
		console.group();
		for (const { stepId, timeDiff } of this._internal.transmission(transmissionId).get()) {
			console.log(`${stepId} (${timeDiff}ms)`);
		}
		console.groupEnd();
	};
}

class LogPrinter {
	private _internal: LoggerInternal;

	constructor(logger: LoggerInternal) {
		this._internal = logger;
	}

	pipelines = () => {
		console.group("Pipelines");
		for (const pipelineId of this._internal.pipelines()) {
			console.log(pipelineId);
		}
		console.groupEnd();
	};

	pipeline = (pipelineId: string) => new PipelinePrinter(this._internal.pipeline(pipelineId));
}

export const registerClient = (logger: LoggerInternal) => {
	window["rxLogger"] = new LogPrinter(logger);
};
