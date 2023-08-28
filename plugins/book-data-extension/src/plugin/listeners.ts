import { BookEntry } from "@librocco/db";
import { addEventListener } from "./window-helpers";
export function listenForExtension(message: string, timeout: number): Promise<boolean> {
	return new Promise((resolve) => {
		let resolved = false;

		const promiseHandler = () => {
			window.removeEventListener("message", handler);

			if (!resolved) {
				clearTimeout(promiseTimer);
				resolve(false);
			}
		};
		const promiseTimer = setTimeout(promiseHandler, timeout);

		const handler = (event: MessageEvent) => {
			if (event.source !== window) return;
			if (event.data.message && event.data.message === message) {
				resolved = true;
				clearTimeout(promiseTimer);

				removeEventListener("message", handler);
				resolve(true);
			}
		};
		addEventListener("message", handler);
	});
}

export function listenForBooks(message: string, timeout: number): Promise<BookEntry[]> {
	return new Promise((resolve) => {
		let resolved = false;

		const promiseHandler = () => {
			window.removeEventListener("message", handler);

			if (!resolved) {
				clearTimeout(promiseTimer);
				resolve([]);
			}
		};
		const promiseTimer = setTimeout(promiseHandler, timeout);

		const handler = (event: MessageEvent) => {
			if (event.source !== window) return;
			if (event.data.message && event.data.message === message) {
				resolved = true;
				clearTimeout(promiseTimer);

				removeEventListener("message", handler);
				resolve(event.data.books);
			}
		};
		addEventListener("message", handler);
	});
}
