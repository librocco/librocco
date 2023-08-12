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

test.only("should show suggestions for publishers and filter with respect to input", async () => {
	const publisherList = ["Penguin", "Puffin", "Pearson", "Penguin Classics", "Penguin Books", "Penguin Random House"];

	render(BookDetailForm, { book, publisherList });

	const publisherInput = screen.getByRole("combobox", { name: "publisher" });

	// Should show all publishers on input start (all publishers start with "P")
	await userEvent.clear(publisherInput);
	await userEvent.type(publisherInput, "P");
	await waitFor(() => {
		publisherList.forEach((publisher) => {
			screen.getByRole("option", { name: publisher });
		});
	});

	// Should filter publishers on input change
	await userEvent.type(publisherInput, "en"); // "Pen" is now in the input field
	await waitFor(() => {
		["Penguin", "Penguin Classics", "Penguin Books", "Penguin Random House"].forEach((publisher) => {
			screen.getByRole("option", { name: publisher });
		});
	});
});

test.only("should display maximum of 10 filtered results", async () => {
	// Create an array going ["Penguin 0", "Pearson 0", "Penguin 1", "Pearson 1", ...and so on]
	// with 15 entries for each (30 in total)
	const publisherList = [
		...(function* () {
			for (let i = 0; i < 15; i++) {
				yield `Penguin ${i}`;
				yield `Pearson ${i}`;
			}
		})()
	];

	render(BookDetailForm, { book, publisherList });
	const publisherInput = screen.getByRole("combobox", { name: "publisher" });

	// Clear and start typing (we need to interact with the input field to expand the suggestions)
	await userEvent.clear(publisherInput);
	await userEvent.type(publisherInput, "P");
	await waitFor(() => {
		// All our publishers start with "P", so the filter will not have taken any effect.
		// Should display first 10 entries from the list.
		expect(screen.getAllByRole("option")).toHaveLength(10);
		publisherList.slice(0, 10).forEach((publisher) => {
			screen.getByRole("option", { name: publisher });
		});
	});

	// Filter using "Penguin"
	await userEvent.clear(publisherInput);
	await userEvent.type(publisherInput, "Penguin");
	await waitFor(() => {
		// Should display first 10 publishers containing "Penguin" (out of 15 total).
		expect(screen.getAllByRole("option")).toHaveLength(10);
		publisherList
			.filter((p) => p.includes("Penguin"))
			.slice(0, 10)
			.forEach((publisher) => {
				screen.getByRole("option", { name: publisher });
			});
	});
});
