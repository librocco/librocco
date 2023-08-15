import { test, vi, expect } from "vitest";
import { render, screen } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";

import ScanInput from "../ScanInput.svelte";

test("should call 'onAdd' with isbn from input on 'Add' button click", async () => {
	const mockOnAdd = vi.fn();
	render(ScanInput, { onAdd: mockOnAdd });

	const input = screen.getByRole("textbox");
	const addButton = screen.getByRole("button", { name: "Add" });

	await userEvent.type(input, "1234567890");
	await userEvent.click(addButton);

	expect(mockOnAdd).toHaveBeenCalledWith("1234567890");
});

test("should call 'onAdd' with isbn from input on 'Enter' button press", async () => {
	const mockOnAdd = vi.fn();
	render(ScanInput, { onAdd: mockOnAdd });

	const input = screen.getByRole("textbox");

	await userEvent.type(input, "1234567890");
	await userEvent.keyboard("{Enter}");

	expect(mockOnAdd).toHaveBeenCalledWith("1234567890");
});

test("should disable the 'Add' button (and \"Enter\" press form submission if isbn and empty string", async () => {
	const mockOnAdd = vi.fn();
	render(ScanInput, { onAdd: mockOnAdd });

	const addButton = screen.getByRole("button", { name: "Add" });

	// Attempt a submit with both button and keyboard
	expect(addButton).toBeDisabled();
	await userEvent.keyboard("{Enter}");

	expect(mockOnAdd).not.toHaveBeenCalled();
});

test("should reset the form (input field) after 'Add' button click", async () => {
	render(ScanInput);

	const input = screen.getByRole("textbox");
	const addButton = screen.getByRole("button", { name: "Add" });

	// Should reset after 'onAdd' action (submit)
	await userEvent.type(input, "1234567890");
	await userEvent.click(addButton);
	expect(input).toHaveValue("");
});

test("should route keyboard input to the scan field (even if the field is not focused)", async () => {
	const mockOnAdd = vi.fn();

	render(ScanInput, { onAdd: mockOnAdd });

	screen.getByRole("textbox");

	await userEvent.keyboard("1234567890{Enter}");
	expect(mockOnAdd).toHaveBeenCalledWith("1234567890");
});
