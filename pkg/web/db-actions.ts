let database: Database = {
  notes: [],
};
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

export const newNote = (note: Note) => {
  const currentDatabase = getDB();

  const newDB = { notes: [...currentDatabase.notes, note] };

  setDB(newDB);

  const promise = new Promise<{ id: string; ok: boolean }>((resolve) => {
    resolve({ id: note._id, ok: true });
  });
  return promise;
};

// get note
export const getNote = (id: Note["_id"]) => {
  const currentDatabase = getDB();

  const note =
    currentDatabase.notes.find((note) => note._id === id) || ({} as Note);

  const promise = new Promise<Note>((resolve) => {
    resolve(note);
  });

  return promise;
};

// set DB
export const setDB = (newDB: Database) => {
  database = newDB;
};

// get DB
export const getDB = () => {
  return database;
};

export const updateNote = (id: Note["_id"], newNote: Note) => {
  const newDatabase = getDB();
  const index = newDatabase.notes.findIndex(({ _id }) => _id === id);
  newDatabase.notes.splice(index, 1);

  setDB({ notes: [...newDatabase.notes, newNote] });

  const promise = new Promise<{ id: string; ok: boolean }>((resolve) => {
    resolve({ id, ok: true });
  });
  return promise;
};

export const deleteDatabase = () => {
  setDB({ notes: [] });
  const promise = new Promise<{ ok: boolean }>((resolve) => {
    resolve({ ok: true });
  });
  return promise;
};
