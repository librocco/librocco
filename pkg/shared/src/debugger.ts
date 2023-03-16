/* eslint-disable @typescript-eslint/no-explicit-any */
export interface DebugCtx {
	name?: string;
	debug?: boolean;
}

export const log =
	<T>(ctx: DebugCtx, step?: string) =>
	(payload: T) => {
		if (ctx.debug) {
			const message = [];
			if (ctx.name) message.push(ctx.name);
			if (step) message.push(step);
			if (message.length) console.log(message.join('::'));

			console.log(payload);
		}
	};
