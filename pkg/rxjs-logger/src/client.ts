import { LoggerInternal, Pipeline } from "./internal";

declare global {
	const window: any;
}

class PipelinePrinter {
	private _internal: Pipeline;

	constructor(pipeline: Pipeline) {
		this._internal = pipeline;
	}

	/** Prints all of the transmissions logged for a given pipeline */
	transmissions = () => {
		console.group(`Pipeline "${this._internal.id}" transmissions:`);
		for (const transmissionId of this._internal.transmissions()) {
			console.log(transmissionId);
		}
		console.groupEnd();
	};

	/** Prints the stats (steps and times for each respective step) for a given transmission in the pipeline */
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

	/** Prints all of the pipelines for which we keep the logs */
	pipelines = () => {
		console.group("Pipelines");
		for (const pipelineId of this._internal.pipelines()) {
			console.log(pipelineId);
		}
		console.groupEnd();
	};

	/** Access the reports for the given pipeline */
	pipeline = (pipelineId: string) => new PipelinePrinter(this._internal.pipeline(pipelineId));
}

/**
 * Register the rxjs logger instance to the window object to make it accessible from
 * the console.
 * This should be ran only once, when the app is initialised.
 *
 * Note: This will cause errors if ran in any environment outside the browser, where the window object
 * is not defined
 */
export const registerClient = (logger: LoggerInternal) => {
	window["rxLogger"] = new LogPrinter(logger);
};
