import { BookInterface, Note } from './types';

/**
 * Database class
 */
class Database {
	private _notes: Note[] = [];

	private _name = '';

	/**
	 * Notes getter
	 */
	public get notes() {
		return this._notes;
	}
	/**
	 * Notes setter
	 */
	public set notes(n: Note[]) {
		this._notes = n;
	}
	/**
	 * Name getter
	 */
	public get name() {
		return this._name;
	}
	/**
	 * Name setter
	 */
	public set name(n: string) {
		this._name = n;
	}
	/**
	 *
	 * @param notes list of notes
	 * @param name name of database
	 */
	constructor(notes: Note[], name: string) {
		this._name = name;
		this._notes = notes;
	}
}
const newNote = (database: Database) => (note: Note) => {
	database.notes = [...database.notes, note];

	return { id: note._id, ok: true };
};

const getNote = (database: Database) => async (id: Note['_id']) =>
	database.notes.find((note) => note._id === id) || ({} as Note);

const getNotes = (database: Database) => async () => {
	return { total_rows: database.notes.length, rows: database.notes };
};

const updateNote = (database: Database) => async (id: Note['_id'], newNote: Note) => {
	const index = database.notes.findIndex(({ _id }) => _id === id);

	const newNotes = database.notes;
	newNotes[index] = newNote;
	database.notes = newNotes;

	return { id, ok: true };
};

const createDatabase = (name: string): Database => {
	const database = new Database([], name);
	return database;
};
const addBook = (database: Database) => async (id: Note['_id'], newBook: BookInterface) => {
	const note = database.notes.find((note) => note._id === id) || ({} as Note);
	const bookIndex = note.books.findIndex((book) => book.isbn === newBook.isbn);
	if (bookIndex !== -1) throw new Error('Book already exists');

	const newBooks = note.books.concat(newBook);
	const newNote = { ...note, books: newBooks };
	const noteIndex = database.notes.findIndex((n) => n._id === note._id);

	database.notes[noteIndex] = newNote;

	return { id, ok: true };
};
const removeBook = (database: Database) => async (id: Note['_id'], isbn: BookInterface['isbn']) => {
	const note = database.notes.find((note) => note._id === id) || ({} as Note);
	const bookIndex = note.books.findIndex((book) => book.isbn === isbn);
	if (bookIndex === -1) throw new Error('Book does not exist');

	const newBooks = note.books.filter((book) => book.isbn !== isbn);
	const newNote = { ...note, books: newBooks };
	const noteIndex = database.notes.findIndex((n) => n._id === note._id);

	database.notes[noteIndex] = newNote;

	return { id, ok: true };
};
const listBooks = (database: Database) => async (id: Note['_id']) => {
	const note = database.notes.find((note) => note._id === id) || ({} as Note);

	return note.books;
};

export const createDatabaseInterface = (name: string) => {
	const database = createDatabase(name);
	return {
		newNote: newNote(database),
		getNote: getNote(database),
		getNotes: getNotes(database),
		updateNote: updateNote(database),
		addBook: addBook(database),
		listBooks: listBooks(database),
		removeBook: removeBook(database)
	};
};
