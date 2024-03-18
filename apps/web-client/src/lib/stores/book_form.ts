import { writable, type Readable } from "svelte/store";

import { createBookDataExtensionPlugin } from "@librocco/book-data-extension";

import type { BookFormData } from "$lib/forms";

import type { BookEntry } from "@librocco/db";
import { toastSuccess, bookFetchingMessages, toastError } from "$lib/toasts";

interface BookFormStore extends Readable<BookFormData | null> {
	openEdit: (book: BookFormData) => void;
	closeEdit: () => void;
	fetch: (book: BookFormData) => void;
}

export function newBookFormStore(): BookFormStore {
	const plugin = createBookDataExtensionPlugin();

	const internalStore = writable<BookFormData | null>(null);

	/**
	 * Set book details to be edited
	 */
	const openEdit = (book: BookFormData | null) => internalStore.set(book);

	/**
	 * Clear book details
	 */
	const closeEdit = () => internalStore.set(null);

	/**
	 * Fetch and fill-in book details via book data extension plugin
	 */
	const fetch = async (book: BookFormData) =>
		plugin.fetchBookData([book.isbn]).then((bookData: BookEntry[]) => {
			if (!bookData.length) {
				toastError(bookFetchingMessages.bookNotFound);
			}
			internalStore.set(bookData[0]);
			toastSuccess(bookFetchingMessages.bookFound);
		});

	return {
		subscribe: internalStore.subscribe,
		openEdit,
		closeEdit,
		fetch
	};
}
