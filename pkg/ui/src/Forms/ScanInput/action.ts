import { tick } from "svelte";
import { writable, get } from "svelte/store";

interface ScanState {
	buffer: string;
	timeout: NodeJS.Timeout;
	target: HTMLInputElement | null;
	form: HTMLFormElement | null;
}

const initialState: ScanState = {
	buffer: "",
	timeout: null,
	target: null,
	form: null
};

// Flush takes in an optional target element and returns a function that will take
// in the buffer value, appends it to target element's internal value, triggering an input event
// and focusing the target.
//
// If no target is passed in, noop.
const flush = (target: HTMLInputElement | undefined, value: string) => {
	if (!target) return;
	// Append the buffer value to the target
	target.value += value;
	// Dispatch the input event (to trigger any listeners)
	target.dispatchEvent(new Event("input"));
	// Focus the target
	target.focus();
};

const store = (() => {
	const store = writable<ScanState>(initialState);

	// Reset resets the store to initial state.
	// Optionally, we can pass in a 'sideEffect' function that will be ran with the state (before reset) as an argument.
	const reset = (sideEffect: (state: ScanState) => void = () => {}) => store.update((state) => (sideEffect(state), initialState));

	// Cancel is ran when timeout runs out - interpreted as input being human input, rather than a scan.
	// When ran, it will 'flush' the buffer to the element the event was directed towards.
	const cancel = () => reset(({ buffer, target }) => flush(target, buffer));

	const registerForm = (node: HTMLFormElement) => store.update((state) => Object.assign(state, { form: node }));
	const unregisterForm = () => store.update((state) => Object.assign(state, { form: null }));

	const submitForm = () => {
		const form = get(store)?.form;
		if (form) {
			form.dispatchEvent(new Event("submit"));
		}
	};

	return Object.assign(store, { reset, cancel, registerForm, unregisterForm, submitForm });
})();

export const scanForm = (form: HTMLFormElement, formAction?: (form?: HTMLFormElement) => { destroy: () => void }) => {
	store.registerForm(form);

	const { destroy: destroyForm } = formAction?.(form) || {};
	const destroy = () => {
		store.unregisterForm();
		destroyForm?.();
	};

	return { destroy };
};

export const scanInput = (node: HTMLInputElement) => {
	const handleNumberKey = (e: KeyboardEvent) => {
		// Capture the event
		e.preventDefault();

		store.update((state) => {
			const { buffer, timeout } = state;

			if (timeout) {
				clearTimeout(timeout);
			}

			const newState: ScanState = {
				...state,
				buffer: buffer + e.key,
				timeout: setTimeout(store.cancel, 50)
			};

			// If the event target is an input element,
			// store its reference to flush the input to it if cancelled (i.e. not a scan input).
			if (e.target instanceof HTMLInputElement) newState.target = e.target;

			return newState;
		});
	};

	const handleEnterKey = (e: KeyboardEvent) =>
		store.reset(({ buffer }) => {
			// If ISBN is ready, flush the buffer and submit the form
			if ([10, 13].includes(buffer.length)) {
				e.preventDefault();
				flush(node, buffer);
				tick().then(store.submitForm);
			}
		});

	const handleKeydown = (e: KeyboardEvent) => (/[0-9]/.test(e.key) ? handleNumberKey(e) : e.key === "Enter" ? handleEnterKey(e) : null);

	window.addEventListener("keydown", handleKeydown);

	return {
		destroy() {
			window.removeEventListener("keydown", handleKeydown);
		}
	};
};
