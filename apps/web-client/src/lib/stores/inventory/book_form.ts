import { writable } from "svelte/store";
import type { BookEntry } from "@librocco/db";

const emptyBook = {
	isbn: "",
	title: "",
	authors: "",
	publisher: "",
	year: "",
	price: 0
};

const bookForm = writable<{ book: BookEntry; modalOpen: boolean; editMode?: boolean }>({
	book: emptyBook,
	modalOpen: false,
	editMode: false
});

export const bookFormStore = {
	subscribe: bookForm.subscribe,
	set: bookForm.set,
	update: bookForm.update
};
