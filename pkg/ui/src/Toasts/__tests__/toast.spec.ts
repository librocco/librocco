import { test, describe, expect, afterEach } from "vitest";
import { cleanup, render } from "@testing-library/svelte";
import html from "svelte-htm";

import { get } from "svelte/store";

import { createToasterStore } from "../toaster";
import { createToastStore, createToastAction } from "../toast";

const toasterStore = createToasterStore();

const defaultToast = {
	message: "I'm a toast",
	duration: 0
};

afterEach(() => {
	cleanup();
	toasterStore.clean();
});

describe("toastStore", () => {
	test("should set up a new toast with a `progress` property", () => {
		const toastStore = createToastStore(toasterStore)(defaultToast);

		const toast = get(toastStore);

		expect(toast).toHaveProperty("message");
		expect(toast).toHaveProperty("duration");

		expect(toast).toHaveProperty("progress", 0);
	});

	test("should start a toasts progress", async () => {
		const toastStore = createToastStore(toasterStore)(defaultToast);

		let progress = 0;
		const unsubscribe = toastStore.subscribe((t) => (progress = t.progress));

		toastStore.setProgress(1);

		// defaultToast duration = 0 => progress should immediately = 1 as soon as its started
		expect(progress).toBe(1);

		unsubscribe();
	});
});

describe("createToastAction", () => {
	test("should set `role` attribute and start toast progresss", async () => {
		toasterStore.push(defaultToast);

		const [toast] = get(toasterStore);

		const toastStore = createToastStore(toasterStore)(toast);
		const toastAction = createToastAction(toastStore);

		let toastEntries = [];
		const unsubscribe = toasterStore.subscribe((toasts) => (toastEntries = toasts));

		expect(toastEntries.length).toBe(1);

		render(html` <span use:action=${(node) => toastAction(node)}> ${defaultToast.message} </span> `);

		expect(document.querySelector("span")).toHaveAttribute("role", "alert");
		// defaultToast duration = 0 => progress should = 1 as soon as its started
		// and toast should be removed immediately
		expect(toastEntries.length).toBe(0);

		unsubscribe();
	});
});
