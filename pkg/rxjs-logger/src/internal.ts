import { DateTime } from "luxon";

import { ValueWithMeta, Logs } from "./types";

import { map, shouldLog } from "./utils";

export class Transmission {
	#pipeline: Pipeline;

	id: string;

	// Both sources and forks keep track of respective transmissions through a map of { pipelineId => transmission }
	private _sources = new Map<string, Transmission>();
	private _forks = new Map<string, Transmission>();

	private _steps = new Map<string, Logs>();

	constructor(pipeline: Pipeline, id: string, sourceTransmissions?: Transmission[]) {
		this.#pipeline = pipeline;
		this.id = id;
		this._sources = new Map(sourceTransmissions?.map((t) => [t.#pipeline.id, t]));
	}

	start<V>(value: V): ValueWithMeta<V> {
		const timestamp = DateTime.now();

		const meta = {
			transmissionId: this.id,
			pipelineId: this.#pipeline.id
		};
		const valueWithMeta = { ...meta, value };

		const firstStep = this.getFirstStep();
		if (firstStep) {
			const startTime = firstStep.timestamp;
			const currentTime = timestamp;
			warn(`Trying to run 'transmission.start' on an already started transmission.\n`, { ...meta, startTime, currentTime });
			return valueWithMeta;
		}

		const stepId = this._sources.size ? "fork" : "start";

		this._steps.set(stepId, {
			stepId,
			timestamp,
			took: 0,
			...valueWithMeta
		});

		return valueWithMeta;
	}

	getFirstStep(): Logs | undefined {
		return this._steps.get("start");
	}

	getLastStep(): Logs | undefined {
		const numSteps = this._steps.size;
		return [...this._steps.values()][numSteps - 1];
	}

	log<V extends Required<ValueWithMeta>>(valueWithMeta: V, stepId: string, took: number): V {
		const timestamp = DateTime.now();

		if (this._steps.size === 0) {
			const startTime = null;
			const currentTime = timestamp;
			warn(`Trying to write logs for a non existing transmission: Did you forget to run 'transmission.start()'?`, {
				...valueWithMeta,
				startTime,
				currentTime
			});
			return valueWithMeta;
		}

		this._steps.set(stepId, {
			...valueWithMeta,
			stepId,
			timestamp,
			took
		});

		return valueWithMeta;
	}

	steps = () => this._steps;

	sources = () => this._sources;

	addSource = (source: Transmission) => {
		this._sources.set(source.#pipeline.id, source);
		return this;
	};

	newFork = (pipeline: Pipeline) => {
		const transmission = pipeline.transmission(this.id, [this]);
		this._forks.set(pipeline.id, transmission);
		return transmission;
	};

	addFork = (transmission: Transmission) => {
		const pipeline = transmission.#pipeline;
		transmission.addSource(this);
		this._forks.set(pipeline.id, transmission);
	};

	forks = () => this._forks;
}

export class Pipeline {
	#logger: LoggerInternal;

	id: string;

	private _transmissions = new Map<string, Transmission>();

	constructor(logger: LoggerInternal, id: string) {
		this.#logger = logger;

		this.id = id;
	}

	transmission = (transmissionId: string, sourceTransmissions?: Transmission[]) => {
		// If transmission doesn't exist, create it
		if (!this._transmissions.has(transmissionId)) {
			this._transmissions.set(transmissionId, new Transmission(this, transmissionId, sourceTransmissions));
		}
		return this._transmissions.get(transmissionId) as Transmission;
	};

	transmissions = () => this._transmissions;

	sources = () => {
		// Go through the transmissions and create a map ({ pipelineId => pipeline }) of all pipelines
		// this pipeline is a fork/join of
		const getSources = (logger: LoggerInternal, transmissions: Map<string, Transmission>) =>
			new Map(
				(function* () {
					for (const t of transmissions.values()) {
						yield* map(t.sources().keys(), (pipelineId) => [pipelineId, logger.pipeline(pipelineId)]);
					}
				})()
			);
		return getSources(this.#logger, this.transmissions());
	};

	forks = () => {
		// Go through the transmissions and create a map ({ pipelineId => pipeline }) of all pipelines
		// forked from this pipeline's transmissions
		const getForks = (logger: LoggerInternal, transmissions: Map<string, Transmission>) =>
			new Map(
				(function* () {
					for (const t of transmissions.values()) {
						yield* map(t.forks().keys(), (pipelineId) => [pipelineId, logger.pipeline(pipelineId)]);
					}
				})()
			);
		return getForks(this.#logger, this.transmissions());
	};
}

/**
 * Internal logger instance:
 * - keeps record of registered pipelines and their corresponding transmissions
 * - exposes an API to store/retrieve the logs per pipeline/transmission, etc
 */
export class LoggerInternal {
	private _pipelines = new Map<string, Pipeline>();

	pipeline = (pipelineId: string) => {
		if (!this._pipelines.has(pipelineId)) {
			this._pipelines.set(pipelineId, new Pipeline(this, pipelineId));
		}
		return this._pipelines.get(pipelineId) as Pipeline;
	};

	pipelines = () => this._pipelines;

	start = <V>(valueWithMeta: ValueWithMeta<V>): ValueWithMeta<V> => {
		/** Skip logging if valueWithMeta is incomplete */
		if (!shouldLog(valueWithMeta)) {
			return valueWithMeta;
		}
		const { pipelineId, transmissionId, value } = valueWithMeta;
		return this.pipeline(pipelineId).transmission(transmissionId).start(value);
	};

	log = <V extends ValueWithMeta>(valueWithMeta: V, stepId: string, took: number): V => {
		/** Skip logging if valueWithMeta is incomplete */
		if (!shouldLog(valueWithMeta)) {
			return valueWithMeta;
		}
		const { pipelineId, transmissionId } = valueWithMeta;
		return this.pipeline(pipelineId).transmission(transmissionId).log(valueWithMeta, stepId, took);
	};
}

const warn = (
	message: string,
	{
		pipelineId,
		transmissionId,
		startTime,
		currentTime
	}: { pipelineId: string; transmissionId: string; startTime: DateTime | null; currentTime: DateTime }
) => {
	console.warn(
		`${message}:\n`,
		`  Pipeline id: ${pipelineId}\n`,
		`  Transmission id: ${transmissionId}\n`,
		`  Started at: ${startTime?.toISO() || "null"}\n`,
		`  Current time: ${currentTime.toISO()}`
	);
};
