import type { BookEntry, DatabaseInterface } from "@librocco/db";
import { bookFormStore } from "$lib/stores/inventory/book_form";

const emptyBook = {
	isbn: "",
	title: "",
	authors: "",
	publisher: "",
	year: "",
	price: 0
};

export const addBookEntry = (db: DatabaseInterface) => async (bookEntry: BookEntry) => {
	if (!bookEntry.isbn) {
		return;
	}

	const booksInterface = db.books();

	booksInterface.upsert([bookEntry]);
	bookFormStore.update((store) => {
		store.book = emptyBook;
		store.modalOpen = false;

		return store;
	});
};

export const handleCloseBookForm = () =>
	bookFormStore.set({
		book: emptyBook,
		modalOpen: false
	});

export const openEditMode = () => bookFormStore.update((store) => ({ ...store, editMode: true }));

export const publisherList = ["TCK Publishing", "Reed Elsevier", "Penguin Random House", "Harper Collins", "Bloomsbury"];

export const handleBookEntry =
	(edit = false) =>
	(book: BookEntry) => {
		bookFormStore.update((store) => {
			store.book = book;
			store.modalOpen = true;
			store.editMode = edit;
			return store;
		});
	};

export const findBook = (db: DatabaseInterface) => (values: BookEntry) => db.books().get([values.isbn]);
