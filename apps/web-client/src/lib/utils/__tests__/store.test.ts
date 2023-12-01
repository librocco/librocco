import { vi, describe, test, expect, afterEach } from "vitest";
import { writable } from "svelte/store";

import { controlledStore, debouncedStore } from "../stores";

import { wait } from "../../__testUtils__/misc";

afterEach(() => {
	vi.clearAllMocks();
});

describe("Debounce store wrapper", () => {
	test("should notify with an update after timeout", async () => {
		const notify = vi.fn();
		const timeout = 500;

		const store = writable(0);
		const debounced = debouncedStore(store, timeout);
		debounced.subscribe(notify);

		// Update the store
		store.set(5);

		// No update should have taken place yet (timeout not reached)
		await wait(200);
		expect(notify).not.toHaveBeenCalled();

		// Update should take place after timeout (timeout is 500)
		await wait(301);
		expect(notify).toHaveBeenCalledTimes(1);
		expect(notify).toHaveBeenCalledWith(5);
	});

	test("should debounce the updates - only dispatch the last one if updates happened at higher rate than the debounce rate", async () => {
		const notify = vi.fn();
		const timeout = 500;

		const store = writable(0);
		const debounced = debouncedStore(store, timeout);
		debounced.subscribe(notify);

		// Update the store three times in close succession
		store.set(1);
		await wait(100);
		store.set(2);
		await wait(400);
		store.set(3);

		// Notify should have been called only with the last value
		await wait(501);
		expect(notify).toHaveBeenCalledTimes(1);
		expect(notify).toHaveBeenCalledWith(3);
	});

	test("should show all updates if the updates happened at a rate lower than the debounce rate", async () => {
		const notify = vi.fn();
		const timeout = 500;

		const store = writable(0);
		const debounced = debouncedStore(store, timeout);
		debounced.subscribe(notify);

		// Update the store with two values with rate slower than the debounce rate
		store.set(4);
		await wait(501);
		store.set(5);

		// Notify should have been called with both values
		await wait(501);
		expect(notify).toHaveBeenCalledTimes(2);
		expect(notify).toHaveBeenCalledWith(4);
		expect(notify).toHaveBeenCalledWith(5);
	});
});

describe("Controlled store wrapper", () => {
	test("should notify with an update only after flush has been called (imperatively)", () => {
		const notify = vi.fn();
		const store = writable();

		const controlled = controlledStore(store);
		controlled.subscribe(notify);

		// Notify will have been called on subscription (with the undefined value) as it's a svelte store after all
		notify.mockClear();

		// Update the store
		store.set("foo");
		store.set("foobar");

		expect(notify).not.toHaveBeenCalled();

		// Flush the store
		controlled.flush();
		expect(notify).toHaveBeenCalledTimes(1);
		expect(notify).toHaveBeenCalledWith("foobar");
	});
});
