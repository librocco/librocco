// import { newNote, updateNote, getNote, deleteDatabase } from "../../db-actions";
import {
  newNote,
  updateNote,
  database,
  getNote,
  deleteDatabase,
} from "../../pouchdb-actions";

// import { note, updatedNote, database } from "../__testData__/dataModel";
import { note, updatedNote } from "../__testData__/dataModel";

describe("Test data model", () => {
  afterAll(async () => {
    const deleted = await deleteDatabase(database);
    expect(deleted).toHaveProperty("ok");
  });
  test("New Note", async () => {
    const { id, ok } = await newNote(database, note);
    expect(ok).toBeTruthy();
    const { _id } = await getNote(database, id);
    expect(_id).toEqual(id);
  });

  test("Update Note", async () => {
    const { id, ok } = await updateNote(database, note._id, updatedNote);
    expect(ok).toBeTruthy();
    const updatedNoteFromDB = await getNote(database, id);
    expect(updatedNoteFromDB._id).toEqual(note._id);
  });
});
