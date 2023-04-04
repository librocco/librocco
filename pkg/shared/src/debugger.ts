export interface DebugCtx {
	name?: string;
	debug?: boolean;
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
