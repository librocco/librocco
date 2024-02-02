import { render, screen, cleanup } from "@testing-library/svelte";
import html from "svelte-htm";
import { test, expect, describe, afterEach } from "vitest";
import userEvent from "@testing-library/user-event";

import { scan } from "../";

afterEach(() => {
	cleanup();
});

describe("Scan action", async () => {
	test("Buffers key input and flushes to scan field when a scanner rapidly types anywhere in the doc", async () => {
		const user = userEvent.setup();

		render(html` <input name="isbn" id="isbn" use:action=${scan} /> `);

		const input = "1234567";
		await user.keyboard(input);

		const inputEl = screen.getByRole("textbox");

		// TODO: Fix types (jest matchers - installed, but, for some reason, not picked up by TS)
		// eslint-disable-next-line @typescript-eslint/ban-ts-comment
		// @ts-ignore
		expect(inputEl).toHaveValue(input);
	});

	test("Won't flush buffer when keyboard input is below scanner speed threshold", async () => {
		const user = userEvent.setup({ delay: 100 });

		render(html` <input name="isbn" id="isbn" use:action=${scan} /> `);

		const input = "1234567";
		await user.keyboard(input);

		const inputEl = screen.getByRole("textbox");

		// TODO: Fix types (jest matchers - installed, but, for some reason, not picked up by TS)
		// eslint-disable-next-line @typescript-eslint/ban-ts-comment
		// @ts-ignore
		expect(inputEl).toHaveValue("");
	});

	test("Won't flush buffer when keyboard input is below buffer length threshold", async () => {
		const user = userEvent.setup();

		render(html` <input name="isbn" id="isbn" use:action=${scan} />`);

		const input = "1234";
		await user.keyboard(input);

		const inputEl = screen.getByRole("textbox");

		// TODO: Fix types (jest matchers - installed, but, for some reason, not picked up by TS)
		// eslint-disable-next-line @typescript-eslint/ban-ts-comment
		// @ts-ignore
		expect(inputEl).toHaveValue("");
	});

	test("Won't buffer non-number keystrokes", async () => {
		const user = userEvent.setup();

		render(html` <input name="isbn" id="isbn" use:action=${scan} />`);

		const input = "wdu";
		await user.keyboard(input);

		const inputEl = screen.getByRole("textbox");

		// TODO: Fix types (jest matchers - installed, but, for some reason, not picked up by TS)
		// eslint-disable-next-line @typescript-eslint/ban-ts-comment
		// @ts-ignore
		expect(inputEl).toHaveValue("");
	});

	test("Won't interfere with input field when it is focussed (allows regular input", async () => {
		const user = userEvent.setup();

		render(html` <input name="isbn" id="isbn" use:action=${scan} /> `);

		const input = "1234567";

		const inputEl = screen.getByRole("textbox");
		inputEl.focus();

		await user.keyboard(input);

		// TODO: Fix types (jest matchers - installed, but, for some reason, not picked up by TS)
		// eslint-disable-next-line @typescript-eslint/ban-ts-comment
		// @ts-ignore
		expect(inputEl).toHaveValue(input);
	});
});
