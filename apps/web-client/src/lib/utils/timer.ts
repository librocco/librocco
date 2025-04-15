import { get } from "svelte/store";
import { persisted } from "svelte-local-storage-store";

type TimeLogger = {
	time: (name: string) => void;
	timeEnd: (name: string) => void;
};

class TimeRecord {
	private rec: Record<string, Record<string, number>> = {};

	keys() {
		return Object.keys(this.rec);
	}

	route(route: string) {
		return this.rec[route];
	}

	set(route: string, name: string, time: number) {
		if (!this.rec[route]) {
			this.rec[route] = {};
		}
		this.rec[route][name] = time;
	}

	get(route: string, name: string) {
		return this.rec[route]?.[name];
	}

	delete(route: string, name: string) {
		if (this.rec[route]) {
			delete this.rec[route][name];
			if (Object.keys(this.rec[route]).length === 0) {
				delete this.rec[route];
			}
		}
	}
}

class TimeRecorder implements TimeLogger {
	/** Keeps record of recorded times */
	private rec = new TimeRecord();
	/**
	 * Keeps record of latest start times (for timeEnd calculations)
	 */
	private startTimesRec = new TimeRecord();
	private isOn = persisted("librocco-time-logger-on", false);

	private routeId: string | null = null;

	time(name: string) {
		if (get(this.isOn) === false) return;

		const routeId = this.routeId;
		if (!routeId) return;

		this.startTimesRec.set(routeId, name, Date.now());
	}

	timeEnd(name: string) {
		if (get(this.isOn) === false) return;

		const routeId = this.routeId;
		if (!routeId) return;

		const startTime = this.startTimesRec.get(routeId, name);
		if (!startTime) {
			console.warn(`No start time found for: ${routeId}:${name}`);
			return;
		}
		const elapsed = Date.now() - startTime;

		this.rec.set(routeId, name, elapsed);
		this.startTimesRec.delete(routeId, name);

		console.log(`${routeId}:${name}`, elapsed);
	}

	activate() {
		this.isOn.set(true);
	}

	disable() {
		this.isOn.set(false);
	}

	report() {
		let report = "";

		for (const route of this.rec.keys()) {
			report += `Route: ${route}:\n`;
			for (const name of Object.keys(this.rec.route(route))) {
				// Total load is added at the bottom
				if (name === "load") continue;

				const time = this.rec.get(route, name);
				if (time) {
					report += `  - ${name}: ${time} ms\n`;
				}
			}

			const totalLoad = this.rec.get(route, "load");
			if (totalLoad) {
				report += `  - **total load: ${totalLoad} ms**\n`;
			}

			report += "\n";
		}

		return report;
	}

	setCurrentRoute(routeId: string) {
		this.routeId = routeId;
	}
}

export const timeLogger = new TimeRecorder();

/** A util used to time a function call */
export function timed<P extends any[], R>(cb: (...params: P) => Promise<R> | R): (...params: P) => Promise<Awaited<R>> {
	return async (...params: P): Promise<Awaited<R>> => {
		const name = (cb.name || "anonymous").replace(/^_+/, ""); // Remove the prefix
		timeLogger.time(name);
		const result = await cb(...params);
		timeLogger.timeEnd(name);
		return result;
	};
}
