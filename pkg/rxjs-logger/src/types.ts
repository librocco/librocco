import { DateTime } from "luxon";
import { Pipeline, Transmission } from "./internal";

export interface LogsMeta {
	pipelineId: string;
	transmissionId: string;
}

export interface ValueWithMeta<V = any> extends LogsMeta {
	value: V;
}

export interface Logs extends ValueWithMeta {
	stepId: string;
	timestamp: DateTime;
	took: number;
}

export interface Stats<T extends Transmission | Pipeline> {
	sources: Map<string, T>;
	steps: Map<string, number>;
	forks: Map<string, T>;
}
