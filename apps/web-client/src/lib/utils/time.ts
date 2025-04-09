export const generateUpdatedAtString = (updatedAt?: Date | string, mode?: "time-only") =>
	updatedAt &&
	(mode === "time-only"
		? new Date(updatedAt).toLocaleTimeString("en", {
				hour: "2-digit",
				minute: "numeric"
			})
		: new Date(updatedAt).toLocaleDateString("en", {
				year: "numeric",
				month: "short",
				day: "numeric",
				hour: "2-digit",
				minute: "numeric"
			}));

/** A util used to time a function call */
export async function timed<P extends any[], R extends any | Promise<any>>(cb: (...params: P) => R, ...params: P): Promise<R> {
	const name = cb.name || "anonymous";
	console.time(name);
	const result = await cb(...params);
	console.timeEnd(name);
	return result;
}
