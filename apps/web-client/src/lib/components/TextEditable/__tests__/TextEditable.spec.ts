/**
 * @vitest-environment jsdom
 */

import { render, screen, fireEvent, act } from "@testing-library/svelte";
import { describe, test, expect } from "vitest";

import TestComponent from "./TestComponent.svelte";
import TextEditable from "../TextEditable.svelte";

describe("TextEditable", () => {
	describe("smoke test", () => {
		test("clicking an edit button should toggle edit mode", async () => {
			render(TextEditable, { isEditing: false, name: "title-to-edit" });

			// The component is not in edit mode, should be plain text.
			expect(screen.queryByRole("textbox", { name: "title-to-edit" })).toBeFalsy();

			// * The div which wraps the presentation/text-node also has "textbox" role
			// * to indicate to screenreaders that it is editable.
			// * We => prefix the "name" of the actual input name with "Edit"
			await act(() => screen.getByRole("textbox", { name: "Edit title-to-edit" }).click());

			const inputElement = screen.getByRole("textbox", { name: "" });
			await act(() => fireEvent.change(inputElement, { target: { value: "New value" } }));

			// Being a textbox, in edit mode, the component value should update on user input
			expect(inputElement).toHaveProperty("value", "New value");
		});

		test("clicking on the component itself should toggle edit mode", async () => {
			render(TextEditable, { value: "New Note", isEditing: false, name: "title-to-edit" });

			// The component is not in edit mode, should be plain text.
			expect(screen.queryByRole("textbox", { name: "title-to-edit" })).toBeFalsy();

			await act(() => screen.getByText("New Note").click());

			const inputElement = screen.getByRole("textbox", { name: "" });
			await act(() => fireEvent.change(inputElement, { target: { value: "New value" } }));

			// Being a textbox, in edit mode, the component value should update on user input
			expect(inputElement).toHaveProperty("value", "New value");
		});

		test("should not allow edit mode if disabled", async () => {
			render(TextEditable, { isEditing: false, disabled: true, value: "New Note", name: "title-to-edit" });

			expect(screen.queryByRole("textbox", { name: "title-to-edit" })).toBeFalsy();

			// Edit button should not be shown
			expect(screen.queryByRole("button")).toBeFalsy();

			// Clicking on the component should be noop
			await act(() => screen.getByText("New Note").click());
			expect(screen.queryByRole("textbox", { name: "title-to-edit" })).toBeFalsy();
		});
	});

	describe("test binding to the value", () => {
		test("should update the value of the text displayed in the component if the bound value gets updated", async () => {
			render(TestComponent, { isEditing: true });

			const [testInput, componentInput] = screen.getAllByRole("textbox");

			await act(() => fireEvent.input(testInput, { target: { value: "New value" } }));

			// The value of the component input should be updated immediatedly
			expect(componentInput).toHaveProperty("value", "New value");
		});

		test("should propagate the update only when the form is saved", async () => {
			render(TestComponent, { isEditing: true });

			const [testInput, componentInput] = screen.getAllByRole("textbox");
			await act(() => fireEvent.input(componentInput, { target: { value: "New value" } }));

			// The value of the test input should not be updated before saving
			expect(testInput).toHaveProperty("value", "");

			// After saving, the bound value (and thus 'controlInput') should be updated
			await act(() => fireEvent.keyDown(componentInput, { key: "Enter" }));
			expect(testInput).toHaveProperty("value", "New value");
		});
	});
});
