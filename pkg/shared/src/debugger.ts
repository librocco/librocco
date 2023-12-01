export interface DebugCtx {
	name?: string;
	debug?: boolean;
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

export class DebugCtxWithTimer implements DebugCtx {
	name?: string;
	debug?: boolean;
	logTimes?: boolean;

	timers: Record<string, number>;
	reports: Record<string, number>;

	constructor(name?: string, { debug = false, logTimes = false } = {}) {
		this.name = name;
		this.debug = debug;
		this.logTimes = logTimes;

		this.timers = {};
		this.reports = {};
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
		this.reports[name] = Date.now() - timer;
		delete this.timers[name];
	}

	getTimes(predicate?: (key: string) => boolean) {
		if (!predicate) {
			return this.reports;
		}
		return Object.fromEntries(Object.entries(this.reports).filter(([key]) => predicate(key)));
	}

	getAvgTimes(filterPredicate?: (key: string) => boolean) {
		const times = Object.values(this.getTimes(filterPredicate));
		const total = times.reduce((acc, cur) => acc + cur, 0);
		return total / times.length;
	}

	clearStats() {
		this.timers = {};
		this.reports = {};
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
