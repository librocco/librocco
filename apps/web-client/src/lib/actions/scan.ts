/* eslint-disable @typescript-eslint/no-empty-function */
import { writable, type Readable, readable } from "svelte/store";

export const MAXIMUM_SCANNER_KEY_GAP = 100;

interface ScanState {
	buffer: string;
	timeout: NodeJS.Timeout;
	target: HTMLInputElement | null;
}

const initialState: ScanState = {
	buffer: "",
	timeout: null,
	target: null
};

export const scan = (node?: HTMLInputElement, on: Readable<boolean> = readable(true)) => {
	const store = (() => {
		const store = writable<ScanState>(initialState);

		// Reset resets the store to initial state.
		// Optionally, we can pass in a 'sideEffect' function that will be ran with the state (before reset) as an argument.
		const reset = (sideEffect: (state: ScanState) => void = () => {}) => store.update((state) => (sideEffect(state), initialState));

		// Cancel is ran when timeout runs out - interpreted as input being human input, rather than a scan.
		// When ran, it will 'flush' the buffer to the element the event was directed towards.
		const cancel = () => reset(({ buffer, target }) => flush(target, buffer));

		return Object.assign(store, { reset, cancel });
	})();

	const handleKeydown = (e: KeyboardEvent) => {
		// We're only interested in number inputs (as isbn)
		if (!/[0-9]/.test(e.key)) return;

		// If the scan input is already focussed, we do not need to buffer input
		if (document.activeElement === node) return;

		// Capture the event
		e.preventDefault();

		store.update((state) => {
			if (state.timeout) {
				clearTimeout(state.timeout);
			}

			const buffer = state.buffer + e.key;
			const timeout = setTimeout(store.cancel, MAXIMUM_SCANNER_KEY_GAP);

			// If we receive 7 or more consecutive inputs with
			// frequency of using a scanner, we can safely assume the input is comming from a scanner
			if (buffer.length >= 7) {
				node.focus();
				// Reset the value of scan input field
				// as we're flushing a full buffer each time
				node.value = "";
				// Flush the full buffer to the scan input field
				flush(node, buffer);

				return {
					// There's not target for flush on cancellation as we're in the scan mode
					// and all of the input keys get flushed to scan input element automatically
					target: null,
					buffer,
					timeout
				};
			}

			return {
				// If the event target is an input element,
				// store its reference to flush the input to it if cancelled (i.e. not a scan input).
				target: e.target instanceof HTMLInputElement ? e.target : null,
				buffer,
				timeout
			};
		});
	};

	const scanOnUnsubscribe = on.subscribe((scanOn) => {
		if (scanOn) {
			window.addEventListener("keydown", handleKeydown);
		} else {
			window.removeEventListener("keydown", handleKeydown);
		}
	});

	return {
		destroy() {
			window.removeEventListener("keydown", handleKeydown);
			scanOnUnsubscribe();
		}
	};
};

// Flush takes in a target element and the buffer value, appends the value to target element's,
// internal value, triggering an input event and focusing the target.
//
// If no target is passed in, noop.
const flush = (target: HTMLInputElement | undefined, value: string) => {
	if (!target) return;
	// Append the buffer value to the target
	target.value += value;
};
