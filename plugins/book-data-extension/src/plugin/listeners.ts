import { BookEntry } from "@librocco/db";
import { addEventListener } from "./window-helpers";
export function listenForExtension(message: string, timeout: number): Promise<boolean> {
	return new Promise((resolve) => {
		const promiseTimer = setTimeout(() => {
			removeEventListener("message", handler);
			resolve(false);
		}, timeout);

		const handler = (event: MessageEvent) => {
			if (event.source !== window) return;
			if (event.data.message && event.data.message === message) {
				clearTimeout(promiseTimer);
				removeEventListener("message", handler);
				resolve(true);
			}
		};
		addEventListener("message", handler);
	});
}

export function listenForBook(message: string, timeout: number): Promise<BookEntry | undefined> {
	return new Promise((resolve) => {
		const promiseTimer = setTimeout(() => {
			removeEventListener("message", handler);
			resolve(undefined);
		}, timeout);

		const handler = (event: MessageEvent) => {
			if (event.source !== window) return;
			if (event.data.message && event.data.message === message) {
				clearTimeout(promiseTimer);
				removeEventListener("message", handler);
				resolve(event.data.book);
			}
		};
		addEventListener("message", handler);
	});
}
