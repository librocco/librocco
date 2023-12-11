import { writable, type Readable } from "svelte/store";

import { createBookDataExtensionPlugin } from "@librocco/book-data-extension";

import type { BookEntry } from "@librocco/db";

interface SlideoverText {
	title: string;
	description: string;
}

type BookFormClosedState = {
	open: false;
};

type BookFormOpenState = {
	open: true;
	slideoverText: SlideoverText;
	book?: Partial<BookEntry>;
};

type BookFormState = BookFormClosedState | BookFormOpenState;

interface BookFormStore extends Readable<BookFormState> {
	open: (book: Partial<BookEntry>) => void;
	close: () => void;
	fetch: (book: Partial<BookEntry>) => void;
}

export function newBookFormStore(): BookFormStore {
	const plugin = createBookDataExtensionPlugin();

	const internalStore = writable<BookFormState>({
		open: false
	});

	// Open the book form in 'create' mode
	const open = async (book: Partial<BookEntry>) => {
		// Open the form
		internalStore.set({
			open: true,
			slideoverText: {
				title: "Create a new book",
				description: "Use this form to manually add a new book to the note"
			},
			book
		});
	};

	// Close the form
	const close = () => internalStore.set({ open: false });

	const fetch = async (book: Partial<BookEntry>) =>
		plugin.fetchBookData([book.isbn]).then((bookData: BookEntry[]) => {
			if (bookData.length) {
				internalStore.set({
					open: true,
					slideoverText: {
						title: "Create a new book",
						description: "Use this form to manually add a new book to the note"
					},
					book: bookData[0]
				});
			}
		});

	return {
		subscribe: internalStore.subscribe,
		open,
		close,
		fetch
	};
}
