interface Database {
  notes: Note[];
}
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

export const newNote = (db: Database, note: Note) => {
  db.notes.push(note);
  return db;
};
export const updateNote = (
  db: Database,
  noteId: Note["_id"],
  newNote: Note
) => {
  const index = db.notes.findIndex(({ _id }) => _id === noteId);
  db.notes[index] = newNote;
  return db;
};
