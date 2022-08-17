import { notes } from "./src/__testData__/dataModel";

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

/** @TODO this is meaningless, write to a file instead or a global var ???? */
export const newNote = (db: Database, note: Note) => {
  db.notes.push(note);
  const promise = new Promise<{ id: string; ok: boolean }>((resolve) => {
    resolve({ id: note._id, ok: true });
  });
  return promise;
};

export const getNote = (db: Database, id: Note["_id"]) => {
  const promise = new Promise<Note>((resolve) => {
    /** @TODO db.find */
    db.notes.find((note) => note._id === id);
    const noteFromList = notes.find((note) => note._id === id) || ({} as Note);
    resolve(noteFromList);
  });

  return promise;
};
export const updateNote = (db: Database, id: Note["_id"], newNote: Note) => {
  const index = db.notes.findIndex(({ _id }) => _id === id);
  db.notes[index] = newNote;

  const noteFromList = notes.find((note) => note._id === id) || ({} as Note);

  const promise = new Promise<{ id: string; ok: boolean }>((resolve) => {
    /** @TODO find a more effective way of testing the update */
    resolve({ id: noteFromList._id, ok: true });
  });
  return promise;
};

export const deleteDatabase = (database: Database) => {
  const promise = new Promise<{ ok: boolean; database: Database }>(
    (resolve) => {
      database = { notes: [] };
      /** @TODO  */
      resolve({ ok: true, database });
    }
  );
  return promise;
};
