import { test, vi, expect } from "vitest";
import { render, screen } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";

import ScanInput from "../ScanInput.svelte";

test("should call 'onAdd' with isbn from input on 'Add' button click", async () => {
	const mockOnAdd = vi.fn();
	const mockOnCreate = vi.fn();
	render(ScanInput, { onAdd: mockOnAdd, onCreate: mockOnCreate });

	const input = screen.getByRole("textbox");
	const addButton = screen.getByRole("button", { name: "Add" });

	await userEvent.type(input, "1234567890");
	await userEvent.click(addButton);

	expect(mockOnAdd).toHaveBeenCalledWith("1234567890");
	expect(mockOnCreate).not.toHaveBeenCalled();
});

test("should call 'onAdd' with isbn from input on 'Enter' button press", async () => {
	const mockOnAdd = vi.fn();
	const mockOnCreate = vi.fn();
	render(ScanInput, { onAdd: mockOnAdd, onCreate: mockOnCreate });

	const input = screen.getByRole("textbox");

	await userEvent.type(input, "1234567890");
	await userEvent.keyboard("{Enter}");

	expect(mockOnAdd).toHaveBeenCalledWith("1234567890");
	expect(mockOnCreate).not.toHaveBeenCalled();
});

test("should disable the 'Add' button (and \"Enter\" press form submission if isbn and empty string", async () => {
	const mockOnAdd = vi.fn();
	const mockOnCreate = vi.fn();
	render(ScanInput, { onAdd: mockOnAdd, onCreate: mockOnCreate });

	const addButton = screen.getByRole("button", { name: "Add" });

	// Attempt a submit with both button and keyboard
	expect(addButton).toBeDisabled();
	await userEvent.keyboard("{Enter}");

	expect(mockOnAdd).not.toHaveBeenCalled();
	expect(mockOnCreate).not.toHaveBeenCalled();
});

test("should call 'onCreate' with isbn from input on 'Create' button click", async () => {
	const mockOnAdd = vi.fn();
	const mockOnCreate = vi.fn();
	render(ScanInput, { onAdd: mockOnAdd, onCreate: mockOnCreate });

	const input = screen.getByRole("textbox");
	const createButton = screen.getByRole("button", { name: "Create" });

	await userEvent.type(input, "1234567890");
	await userEvent.click(createButton);

	expect(mockOnAdd).not.toHaveBeenCalled();
	expect(mockOnCreate).toHaveBeenCalledWith("1234567890");
});

test("should reset the form (input field) after either 'Add' or 'Create' button click", async () => {
	render(ScanInput);

	const input = screen.getByRole("textbox");
	const addButton = screen.getByRole("button", { name: "Add" });
	const createButton = screen.getByRole("button", { name: "Create" });

	// Should reset after 'onAdd' action (submit)
	await userEvent.type(input, "1234567890");
	await userEvent.click(addButton);
	expect(input).toHaveValue("");

	// Should reset after 'onCreate' action
	await userEvent.type(input, "1234567890");
	await userEvent.click(createButton);
	expect(input).toHaveValue("");
});
