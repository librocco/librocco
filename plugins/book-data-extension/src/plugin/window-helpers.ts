export function postMessage(message: string) {
	if (typeof window !== "undefined") {
		// This code will only run on the client side
		window.postMessage({ message }, "*");
	}
}

export function addEventListener(event: string, cb: any) {
	if (typeof window !== "undefined") {
		// This code will only run on the client side
		window.addEventListener(event, cb);
	}
}

export function removeEventListener(type: string, listener: any) {
	if (typeof window !== "undefined") {
		// This code will only run on the client side
		window.removeEventListener(type, listener);
	}
}
