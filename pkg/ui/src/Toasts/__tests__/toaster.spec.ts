import { test, describe, expect, afterEach } from "vitest";
import { cleanup, render } from "@testing-library/svelte";
import Fragment from "svelte-fragment-component";
import html from "svelte-htm";

import { get } from "svelte/store";

import { createToasterStore, createToaster } from "../toaster";

import TestToaster from "./TestToaster.svelte";

const defaultToast = {
	message: "I'm a toast",
	duration: 2000,
	pausable: false
};

afterEach(() => {
	cleanup();
});

describe("toasterStore", () => {
	test("should push new toasts to queue and assign them an id", () => {
		const toaster = createToasterStore();

		toaster.push(defaultToast);

		const [toast] = get(toaster);

		expect(toast).toHaveProperty("id");
	});

	test("should pop toasts by id", () => {
		const toaster = createToasterStore();

		const toast2 = { ...defaultToast, message: "message 2" };
		const toast3 = { ...defaultToast, message: "message 3" };

		toaster.push(defaultToast);
		toaster.push(toast2);
		toaster.push(toast3);

		const [, secondToast] = get(toaster);

		toaster.pop(secondToast.id);

		const toasts = get(toaster);

		expect(toasts.length).toBe(2);

		expect(toasts[0].message).toEqual(toast3.message);
		expect(toasts[1].message).toEqual(defaultToast.message);
	});

	test("should remove all toasts", () => {
		const toaster = createToasterStore();

		toaster.push(defaultToast);
		toaster.push(defaultToast);

		toaster.clean();

		const toasts = get(toaster);

		expect(toasts.length).toBe(0);
	});
});

describe("createToaster", () => {
	test("sets toaster in module map, which can be accessed from other components", () => {
		const toasterId = "special-test-toaster";

		render(
			html`
				<${Fragment}
					onCreate=${() => {
						const toaster = createToaster(toasterId);

						toaster.push(defaultToast);
					}}
				>
					<${TestToaster} toasterId=${toasterId}/>
				</${Fragment}>
			`
		);

		expect(document.querySelector("span")).toHaveTextContent(defaultToast.message);
	});
});
