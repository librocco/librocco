/* eslint-disable @typescript-eslint/ban-types */
import { Result } from "../types";

import { addEventListener, removeEventListener } from "./window-helpers";

type MessageData<T = {}> = { message: string } & T;

/**
 * A helper function used to create the response listener - listening to a message from the extension. The timeout
 * is applied so as to simulate the req/res behaviour (if it times out, will return a failed result).
 */
export function listenWithTimeout(message: string, timeout: number): Promise<Result<null>>;
export function listenWithTimeout<T, R>(message: string, cb: (data: MessageData<T>) => R, timeout: number): Promise<Result<R>>;
export function listenWithTimeout<T, R>(..._params: any[]): Promise<Result<R>> | Promise<Result<null>> {
	const [message, cb, timeout] =
		_params.length === 3
			? (_params as [message: string, cb: (data: MessageData<T>) => R, timeout: number])
			: [_params[0], undefined, _params[1]];

	return new Promise((resolve) => {
		const promiseTimer = setTimeout(() => {
			removeEventListener("message", handler);
			resolve({ ok: false } as Result<R>);
		}, timeout);

		const handler = (event: MessageEvent) => {
			if (event.source !== window) return;
			if (event.data?.message === message) {
				clearTimeout(promiseTimer);
				removeEventListener("message", handler);
				if (cb) {
					return resolve({ ok: true, data: cb(event.data) } as Result<R>);
				}
				return resolve({ ok: true });
			}
		};
		addEventListener("message", handler);
	});
}

/**
 * Creates a continous listener and performs 'handler' side-effect on each matched message.
 * Returns a cleanup function (removing the listener). This is useful if handler is used to create
 * an observable stream from - will deregister the handler when observable is GC'd
 */
export function continuousListener<D>(message: string, handler: (data: D) => void) {
	const _handler = (event: MessageEvent) => {
		if (event.source !== window) return;
		if (!(event.data?.message === message)) return;
		handler(event.data);
	};
	addEventListener("message", _handler);
	return () => removeEventListener("message", _handler);
}
