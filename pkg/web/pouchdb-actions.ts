import Pouchdb from "pouchdb";

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

export const database = new Pouchdb("notes");

export const newNote = async (db: PouchDB.Database, note: Note) => {
  const d = await db.put(note);

  return d;
};

export const listNotes = async (db: PouchDB.Database) => {
  const notes = await db.allDocs();

  return notes;
};

export const getNote = async (db: PouchDB.Database, id: Note["_id"]) => {
  const note = await db.get(id);

  return note;
};

export const updateNote = async (
  db: PouchDB.Database,
  noteId: Note["_id"],
  newNote: Note
) => {
  const note = await db.get(noteId);
  return db.put({ ...newNote, _id: note._id, _rev: note._rev });
};

export const deleteDatabase = (database: PouchDB.Database) => {
  return database.destroy();
};
