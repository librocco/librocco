import { vi, test, describe, expect, afterEach } from "vitest";
import { cleanup, render } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import html from "svelte-htm";

import { get } from "svelte/store";

import { createToasterStore } from "../toaster";
import { createToastStore, createToastAction } from "../toast";

const toasterStore = createToasterStore();

const defaultToast = {
	message: "I'm a toast",
	duration: 100,
	pausable: false
};

afterEach(() => {
	cleanup();
	toasterStore.clean();
});

describe("toastStore", () => {
	test("should set up a new toast with a `progress` property", () => {
		const toastStore = createToastStore(toasterStore)({ ...defaultToast, id: "1-1" });

		const toast = get(toastStore);

		expect(toast).toHaveProperty("message");
		expect(toast).toHaveProperty("duration");

		expect(toast).toHaveProperty("progress", 0);
	});

	test("should start a toasts progress", async () => {
		const toastStore = createToastStore(toasterStore)({ ...defaultToast, duration: 0, id: "1-1" });

		let progress = 0;
		const unsubscribe = toastStore.subscribe((t) => (progress = t.progress));

		toastStore.setProgress(1);

		// defaultToast duration = 0 => progress should immediately = 1 as soon as its started
		expect(progress).toBe(1);

		unsubscribe();
	});

	test("should close a toast", () => {
		// we have to add the toast via toasterStore so that an ID can be assigned and pop(id) will worrk
		toasterStore.push(defaultToast);

		const [toast] = get(toasterStore);

		const toastStore = createToastStore(toasterStore)(toast);

		toastStore.close();

		const toasts = get(toasterStore);

		expect(toasts.length).toBe(0);
	});
});

describe("createToastAction", () => {
	test("should set `role` attribute and start toast progresss", async () => {
		// we have to add the toast via toasterStore so that an ID can be assigned and pop(id) will worrk
		toasterStore.push({ ...defaultToast, duration: 0 });

		const [toast] = get(toasterStore);

		const toastStore = createToastStore(toasterStore)(toast);
		const toastAction = createToastAction(toastStore);

		let toastEntries = [];
		const unsubscribe = toasterStore.subscribe((toasts) => (toastEntries = toasts));

		expect(toastEntries.length).toBe(1);

		render(html` <span use:action=${(node) => toastAction(node)}> ${defaultToast.message} </span> `);

		// TODO: Fix types (jest matchers - installed, but, for some reason, not picked up by TS)
		// eslint-disable-next-line @typescript-eslint/ban-ts-comment
		// @ts-ignore
		expect(document.querySelector("span")).toHaveAttribute("role", "alert");
		// defaultToast duration = 0 => progress should = 1 as soon as its started
		// and toast should be removed immediately
		expect(toastEntries.length).toBe(0);

		unsubscribe();
	});

	test("should pause and resume toast progress if toast is pausable", async () => {
		const user = userEvent.setup();

		toasterStore.push({ ...defaultToast, pausable: true });

		const [toast] = get(toasterStore);

		const toastStore = createToastStore(toasterStore)(toast);
		const toastAction = createToastAction(toastStore);

		const mockSetProgress = vi.fn();
		toastStore.setProgress = mockSetProgress;

		render(html` <span use:action=${(node) => toastAction(node)}> ${defaultToast.message} </span> `);

		const toastEl = document.querySelector("span");

		await user.hover(toastEl);

		// once onMount when action is called; twice on `pause`
		expect(mockSetProgress).toHaveBeenCalledTimes(2);

		await user.unhover(toastEl);

		// thrice on `resume`
		expect(mockSetProgress).toHaveBeenCalledTimes(3);
	});
});
