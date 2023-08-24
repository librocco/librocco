import { test, vi, expect } from "vitest";
import { render, screen } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";

import ScanInput from "../ScanInput/ScanInput.svelte";

test("should call 'onAdd' with isbn from input on 'Add' button click", async () => {
	const mockOnAdd = vi.fn();
	render(ScanInput, { onAdd: mockOnAdd });

	const input = screen.getByRole("textbox");
	const addButton = screen.getByRole("button", { name: "Add" });

	await userEvent.type(input, "1234567890", { delay: 100 });
	await userEvent.click(addButton);

	expect(mockOnAdd).toHaveBeenCalledWith("1234567890");
});

test("should call 'onAdd' with isbn from input on 'Enter' button press", async () => {
	const mockOnAdd = vi.fn();
	render(ScanInput, { onAdd: mockOnAdd });

	const input = screen.getByRole("textbox");

	await userEvent.type(input, "1234567890", { delay: 100 });
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
	await userEvent.type(input, "1234567890", { delay: 100 });
	await userEvent.click(addButton);
	expect(input).toHaveValue("");
});

test("should route keyboard input to the scan field (even if the field is not focused)", async () => {
	const mockOnAdd = vi.fn();

	render(ScanInput, { onAdd: mockOnAdd });

	await userEvent.keyboard("1234567890");
	await userEvent.keyboard("{Enter}");

	expect(mockOnAdd).toHaveBeenCalledWith("1234567890");
});

test("should not route keyboard input to the text field if input is slower than a scan input would be", async () => {
	const mockOnAdd = vi.fn();

	render(ScanInput, { onAdd: mockOnAdd });

	await userEvent.keyboard("1234567890", { delay: 100 });
	await userEvent.keyboard("{Enter}");

	expect(mockOnAdd).not.toHaveBeenCalled();
});

test("if scan input element already has some value (from user input), should overwrite it on scan input (to prevent mixing of the two)", async () => {
	const mockOnAdd = vi.fn();

	render(ScanInput, { onAdd: mockOnAdd });

	// Add some existing value to the scan input field
	userEvent.type(screen.getByRole("textbox"), "987", { delay: 100 });

	await userEvent.keyboard("1234567890");
	await userEvent.keyboard("{Enter}");

	expect(mockOnAdd).toHaveBeenCalledWith("1234567890");
});
