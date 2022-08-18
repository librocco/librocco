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

export const newNote = async (note: Note) => {
  const d = await database.put(note);

  return d;
};

export const listNotes = async () => {
  const notes = await database.allDocs();

  return notes;
};

export const getNote = async (id: Note["_id"]) => {
  const note = await database.get(id);

  return note;
};

export const updateNote = async (noteId: Note["_id"], newNote: Note) => {
  const note = await database.get(noteId);
  return database.put({ ...newNote, _id: note._id, _rev: note._rev });
};

export const deleteDatabase = () => {
  return database.destroy();
};
