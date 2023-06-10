import { DateTime } from "luxon";

export interface LogsMeta {
	pipelineId: string;
	streamId: string;
}

export interface ValueWithMeta<V = any> extends LogsMeta {
	value: V;
}

export interface Logs extends ValueWithMeta {
	stepId: string;
	timestamp: DateTime;
	timeDiff: number;
}
