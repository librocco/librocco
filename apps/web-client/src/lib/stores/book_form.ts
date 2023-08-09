import { writable, type Readable } from "svelte/store";

import type { BookEntry, DatabaseInterface } from "@librocco/db";

interface SlideoverText {
	title: string;
	description: string;
}

interface BookFormProps {
	mode: "create" | "edit";
	book?: Partial<BookEntry>;
}

type BookFormClosedState = {
	open: false;
};

type BookFormOpenState = {
	open: true;
	slideoverText: SlideoverText;
	bookFormProps: BookFormProps;
};

type BookFormState = BookFormClosedState | BookFormOpenState;

type OpenCreate = (isbn?: string) => Promise<void>;
type OpenEdit = (book: Partial<BookEntry>) => void;
interface OpenHandlerLookup {
	create: OpenCreate;
	edit: OpenEdit;
}

interface BookFormStore extends Readable<BookFormState> {
	open: <M extends "create" | "edit">(mode: M) => OpenHandlerLookup[M];
	close: () => void;
}

export function newBookFormStore(db: DatabaseInterface): BookFormStore {
	const internalStore = writable<BookFormState>({
		open: false
	});

	// Open the book form in 'create' mode
	const openCreate: OpenCreate = async (isbn) => {
		// Open the form
		internalStore.set({
			open: true,
			slideoverText: {
				title: "Create a new book",
				description: "Use this form to manually add a new book to the note"
			},
			bookFormProps: {
				mode: "create",
				book: { isbn }
			}
		});

		// Try and fetch book data from the db (if it exists), in the background
		const [book] = await db.books().get([isbn]);
		// If book exists, update the form store (the form component will update reactively)
		if (book) {
			internalStore.update((store) => ({ ...store, bookFormProps: { ...(store as BookFormOpenState).bookFormProps, book } }));
		}
	};

	// Open the book form in 'edit' mode
	const openEdit: OpenEdit = (book) =>
		internalStore.set({
			open: true,
			slideoverText: {
				title: "Edit book details",
				description: "Use this form to manually edit details of an existing book in the note"
			},
			bookFormProps: {
				mode: "edit",
				book
			}
		});

	// A HOF creating the open handler for given ('create' | 'edit') mode
	const open = <M extends "create" | "edit">(mode: M): OpenHandlerLookup[M] =>
		({
			create: openCreate,
			edit: openEdit
		}[mode]);

	// Close the form
	const close = () => internalStore.set({ open: false });

	return {
		subscribe: internalStore.subscribe,
		open,
		close
	};
}

const warnCreateNotSupported = () => {
	console.warn(
		"[Create functionality not supported]:\n" +
			"  No note provided to the store initializer, this is a no-op, but it might be a bug.\n" +
			"  Create mode is not supported in 'stock' view.\n" +
			"  If this is an 'inbound' or 'outbound' view, check the book store initializer."
	);
};
