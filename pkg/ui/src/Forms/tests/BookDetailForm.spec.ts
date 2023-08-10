import { test, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";

import { BookDetailForm } from "$lib/Forms";

const book = {
	isbn: "819200012",
	title: "A brief history of the cosmos and essential kitchen appliances",
	price: 15,
	authors: "Stephen Hawking, Bill Bryson",
	publisher: "Penguin",
	editedBy: "Anonymous",
	outOfPrint: true,
	year: 2021
};

afterEach(() => {
	cleanup();
	vi.resetAllMocks();
});

test("sets form field initial values via props:", () => {
	render(BookDetailForm, { book });

	expect(screen.getByRole("textbox", { name: "isbn" })).toHaveValue(book.isbn);
	expect(screen.getByRole("textbox", { name: "title" })).toHaveValue(book.title);
	expect(screen.getByRole("spinbutton", { name: "price" })).toHaveValue(book.price);
	expect(screen.getByRole("textbox", { name: "authors" })).toHaveValue(book.authors);
	expect(screen.getByRole("combobox", { name: "publisher" })).toHaveValue(book.publisher);
	expect(screen.getByRole("textbox", { name: "editedBy" })).toHaveValue(book.editedBy);
	expect(screen.getByRole("checkbox", { name: "Out of print" })).toBeChecked();
});

test("should disble isbn field to prevent unintentional overwrites", () => {
	render(BookDetailForm, { book });
	expect(screen.getByRole("textbox", { name: "isbn" })).toBeDisabled();
});

test("should set field values if 'book' prop gets updated", async () => {
	const { component } = render(BookDetailForm);

	expect(screen.getByRole("textbox", { name: "isbn" })).toHaveValue("");
	expect(screen.getByRole("textbox", { name: "title" })).toHaveValue("");
	expect(screen.getByRole("spinbutton", { name: "price" })).toHaveValue(0);
	expect(screen.getByRole("textbox", { name: "authors" })).toHaveValue("");
	expect(screen.getByRole("combobox", { name: "publisher" })).toHaveValue("");
	expect(screen.getByRole("textbox", { name: "editedBy" })).toHaveValue("");
	expect(screen.getByRole("checkbox", { name: "Out of print" })).not.toBeChecked();

	component.$set({ book });

	await waitFor(() => {
		expect(screen.getByRole("textbox", { name: "isbn" })).toHaveValue(book.isbn);
		expect(screen.getByRole("textbox", { name: "title" })).toHaveValue(book.title);
		expect(screen.getByRole("spinbutton", { name: "price" })).toHaveValue(book.price);
		expect(screen.getByRole("textbox", { name: "authors" })).toHaveValue(book.authors);
		expect(screen.getByRole("combobox", { name: "publisher" })).toHaveValue(book.publisher);
		expect(screen.getByRole("textbox", { name: "editedBy" })).toHaveValue(book.editedBy);
		expect(screen.getByRole("checkbox", { name: "Out of print" })).toBeChecked();
	});
});

test("should fire 'sumbmit' event on submit", async () => {
	const mockSubmit = vi.fn();

	const { component } = render(BookDetailForm, { book });
	component.$on("submit", (e) => mockSubmit(e.detail));

	const saveButton = screen.getByText("Save");
	userEvent.click(saveButton);

	await waitFor(() => expect(mockSubmit).toHaveBeenCalledWith(book));
});

test("should not allow submitting the form without required fields", async () => {
	const mockSubmit = vi.fn();

	const { component } = render(BookDetailForm);
	component.$on("submit", (e) => mockSubmit(e.detail));

	const saveButton = screen.getByText("Save");
	userEvent.click(saveButton);

	// Not the best way to test this, but we can safely assume that the submit handler will have been called within these 500ms.
	//
	// This way we're testing that the submit handler is not called as field errors are shown using some special logic in the form,
	// without rendering additional html elements (which would be easy to find).
	await new Promise((res) => setTimeout(res, 500));
	expect(mockSubmit).not.toHaveBeenCalled();
});

test("should fire 'cancel' event on cancel button click", async () => {
	const mockCancel = vi.fn();

	const { component } = render(BookDetailForm, { book });
	component.$on("cancel", () => mockCancel());

	const cancelButton = screen.getByText("Cancel");
	userEvent.click(cancelButton);

	await waitFor(() => expect(mockCancel).toHaveBeenCalled());
});

test("should allow specifying a custom publisher", async () => {
	const mockSubmit = vi.fn();

	const { component } = render(BookDetailForm, { book });
	component.$on("submit", (e) => mockSubmit(e.detail));

	const publisherInput = screen.getByRole("combobox", { name: "publisher" });
	await userEvent.clear(publisherInput);
	await userEvent.type(publisherInput, "Custom publisher");

	const saveButton = screen.getByText("Save");
	userEvent.click(saveButton);

	await waitFor(() => expect(mockSubmit).toHaveBeenCalledWith({ ...book, publisher: "Custom publisher" }));
});
