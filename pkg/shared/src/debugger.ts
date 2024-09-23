import { filter, reduce } from "./generators";

export interface DebugCtx {
	name?: string;
	debug?: boolean;
	include?: string[];
	exclude?: string[];
	logTimes?: boolean;
	logTimerStart?: (name: string) => void;
	logTimerEnd?: (name: string) => void;
}

export const log =
	<T>(ctx: DebugCtx, step?: string) =>
	(payload: T) => {
		if (ctx.debug) {
			const message = [`[${Date.now()}]`];
			if (ctx.name) message.push(ctx.name);
			if (step) message.push(step);

			console.log(message.join("::"));

			console.log(payload);
		}
	};

export const addNode = (ctx: DebugCtx, id: string, meta = "") => {
	// Check if the node should be included in the logs tree
	const exclude = (ctx.include && !ctx.include.includes(id)) || ctx.exclude?.includes(id);
	const debug = !exclude && ctx.debug;
	const name = [id, meta].filter(Boolean).join("::");
	return { name: [ctx.name, name].filter(Boolean).join(": "), debug };
};

export class DebugCtxWithTimer implements DebugCtx {
	name?: string;
	debug?: boolean;
	logTimes?: boolean;

	timers: Record<string, number>;
	reports: Map<string, number>;

	constructor(name?: string, { debug = false, logTimes = false } = {}) {
		this.name = name;
		this.debug = debug;
		this.logTimes = logTimes;

		this.timers = {};
		this.reports = new Map<string, number>();
	}

	logTimerStart(name: string) {
		this.timers[name] = Date.now();
	}

	logTimerEnd(name: string) {
		const timer = this.timers[name];
		if (!timer) {
			console.log(`timer not found: '${name}'`);
			return;
		}
		this.reports.set(name, Date.now() - timer);
		delete this.timers[name];
	}

	getTimes(predicate?: (key: string) => boolean) {
		if (!predicate) {
			return this.reports;
		}
		return new Map(filter(this.reports, ([key]) => predicate(key)));
	}

	getAvgTimes(filterPredicate?: (key: string) => boolean) {
		const times = this.getTimes(filterPredicate);
		const total = reduce(times, (acc, [, cur]) => acc + cur, 0);
		return total / times.size;
	}

	clearStats() {
		this.timers = {};
		this.reports = new Map<string, number>();
	}
}

export const logTimerStart = (ctx: DebugCtx, name: string) => {
	if (ctx.logTimes && ctx.logTimerStart) {
		ctx.logTimerStart(name);
	}
};
export const logTimerEnd = (ctx: DebugCtx, name: string) => {
	if (ctx.logTimes && ctx.logTimerEnd) {
		ctx.logTimerEnd(name);
	}
};
