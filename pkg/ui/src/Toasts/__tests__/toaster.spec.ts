import { test, describe, expect, afterEach } from "vitest";
import { screen, cleanup, render } from "@testing-library/svelte";
import Fragment from "svelte-fragment-component";
import html from "svelte-htm";

import { get } from "svelte/store";

import { createToasterStore, createToaster } from "../toaster";

import TestToaster from "./TestToaster.svelte";

const defaultToast = {
	message: "I'm a toast",
	duration: 2000
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

		toaster.push(defaultToast);

		const [toast] = get(toaster);

		toaster.pop(toast.id);

		const toasts = get(toaster);

		expect(toasts.length).toBe(0);
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
	test("should set toaster context", () => {
		render(
			html`
				<${Fragment}
					onCreate=${() => {
						const toaster = createToaster("default");

						toaster.push(defaultToast);
					}}
				>
					<${TestToaster} />
				</${Fragment}>
			`
		);
		expect(document.querySelector("span")).toHaveTextContent(defaultToast.message);
	});
});
