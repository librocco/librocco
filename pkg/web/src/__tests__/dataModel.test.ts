// import { newNote, updateNote, getNote, deleteDatabase } from "../../db-actions";
import {
  newNote,
  updateNote,
  getNote,
  deleteDatabase,
} from "../../pouchdb-actions";

import { note, updatedNote } from "../__testData__/dataModel";

describe("Test data model", () => {
  afterAll(async () => {
    const deleted = await deleteDatabase();
    expect(deleted).toHaveProperty("ok");
  });
  test("New Note", async () => {
    const { id, ok } = await newNote(note);
    expect(ok).toBeTruthy();
    const { _id } = await getNote(id);
    expect(_id).toEqual(id);
  });

  test("Update Note", async () => {
    const { id, ok } = await updateNote(note._id, updatedNote);
    expect(ok).toBeTruthy();
    const updatedNoteFromDB = await getNote(id);
    expect(updatedNoteFromDB._id).toEqual(note._id);
  });
});
