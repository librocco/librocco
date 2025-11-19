/**
 * Mock for $app/stores module
 * Used in test environment where SvelteKit modules are not available
 */

import { readable, writable } from "svelte/store";

export const page = readable({
	url: new URL("http://localhost:3000"),
	params: {},
	route: { id: null },
	status: 200,
	error: null,
	data: {},
	form: undefined,
	state: {}
});

export const navigating = writable(null);
export const updated = readable(false);
