import Pouchdb from 'pouchdb';

export interface Note {
	_id: string;
	books: BookInterface[];
}

export interface BookInterface {
	isbn: string;
	title: string;
	author: string;
	editor: string;
	price: number;
	quantity: number;
	note?: string;
	date?: string;
}

/** @TODO database interface type */
export const createDatabaseInterface = (name: string) => {
	const db = new Pouchdb(name);
	return {
		newNote: newNote(db),
		getNote: getNote(db),
		getNotes: getNotes(db),
		updateNote: updateNote(db),
		addBook: addBook(db),
		listBooks: listBooks(db),
		removeBook: removeBook(db)
	};
};

const newNote = (database: PouchDB.Database) => (note: Note) => database.put(note);

const getNotes = (database: PouchDB.Database) => () => database.allDocs();

const getNote = (database: PouchDB.Database) => (id: Note['_id']) => database.get(id);

const updateNote = (database: PouchDB.Database) => async (id: Note['_id'], newNote: Note) => {
	const note = await database.get(id);
	return database.put({ ...newNote, _id: note._id, _rev: note._rev });
};

const addBook = (database: PouchDB.Database) => async (id: Note['_id'], newBook: BookInterface) => {
	const note = (await database.get(id)) as Note;
	// make sure it doesn't already exist
	const index = note.books.findIndex((book) => book.isbn === newBook.isbn);
	if (index !== -1) throw new Error('Book already exists');

	const books = note.books;
	books.push(newBook);

	return database.put({ ...note, books });
};
const listBooks = (database: PouchDB.Database) => async (id: Note['_id']) => {
	const { books } = await database.get(id);
	return books;
};
const removeBook =
	(database: PouchDB.Database) => async (id: Note['_id'], isbn: BookInterface['isbn']) => {
		const note = (await database.get(id)) as Note;
		// make sure its there
		const index = note.books.findIndex((book) => book.isbn === isbn);

		/** @TODO create error interface */
		if (index === -1) throw new Error('Book does not exist');

		const newBooks = note.books.filter((book) => book.isbn !== isbn);
		return database.put({ ...note, books: newBooks });
	};
