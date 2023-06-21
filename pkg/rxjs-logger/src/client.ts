import { Stats } from "./types";

import { LoggerInternal } from "./internal";
import { LogReporter, newLogReporter, PipelineReporter } from "./reporter";

import { map } from "./utils";

declare global {
	const window: any;
}

class PipelinePrinter {
	private _reporter: PipelineReporter;

	constructor(reporter: PipelineReporter) {
		this._reporter = reporter;
	}

	private id = () => this._reporter.id();

	/**
	 * Prints a table of transmission steps and times for each respective step for each transmission in the pipeline
	 */
	transmissions = () => {
		console.group(`Pipeline "${this.id()}" transmissions:`);

		const transmissions = new Map(
			map(this._reporter.transmissions(), ([stepId, stats]) => [
				stepId,
				Object.entries(stats).reduce((acc, [transmissionId, took]) => ({ ...acc, [transmissionId]: `${took}ms` }), {})
			])
		);
		const transmissionsTableObj = Object.fromEntries(transmissions);

		console.table(transmissionsTableObj);

		console.groupEnd();
	};

	/**
	 * Prints the stats:
	 * - sources (pipelines or transmisisons, depending of the stats type)
	 * - steps steps and times for each respective step (steps for a transmission, step averages for a pipeline)
	 * - forks (pipelines or transmissions, depending of the stats type)
	 */
	private printStats({ sources, steps, forks }: Stats<any>, title: string) {
		console.group(title);

		console.log("Sources:", [...sources.keys()]);
		for (const [stepId, timeDiff] of steps) {
			console.log(`${stepId} (${timeDiff}ms)`);
		}
		console.log("Forks:", [...forks.keys()]);

		console.groupEnd();
	}

	transmission = (transmissionId: string) => {
		const transmission = this._reporter.transmission(transmissionId);
		this.printStats(transmission, `Transmission ${transmissionId} stats:`);
	};

	stats = () => {
		this.printStats(this._reporter.stats(), `Pipeline "${this.id()}" stats:`);
	};
}

class LogPrinter {
	private _reporter: LogReporter;

	constructor(logger: LoggerInternal) {
		this._reporter = newLogReporter(logger);
	}

	/** Prints all of the pipelines for which we keep the logs */
	pipelines = () => {
		console.group("Pipelines");
		for (const pipelineId of this._reporter.pipelines()) {
			console.log(pipelineId);
		}
		console.groupEnd();
	};

	/** Access the reports for the given pipeline */
	pipeline = (pipelineId: string) => new PipelinePrinter(this._reporter.pipeline(pipelineId));
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
