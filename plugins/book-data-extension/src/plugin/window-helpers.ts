export function postMessage(message: string) {
	window.postMessage(message, "*");
}

export function addEventListener(event: string, cb: any) {
	window.addEventListener(event, cb);
}

export function removeEventListener(type: string, listener: any) {
	window.removeEventListener(type, listener);
}
