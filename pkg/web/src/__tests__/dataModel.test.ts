// import { newNote, updateNote } from "../../db-actions";
import { newNote, updateNote, database, getNote } from "../../pouchdb-actions";

import { note, updatedNote } from "../__testData__/dataModel";

describe("Test data model", () => {
  afterAll(async () => {
    const deleted = await database.destroy();
    expect(deleted).toHaveProperty("ok");
  });
  test("New Note", async () => {
    const { id, ok } = await newNote(database, note);
    expect(ok).toBeTruthy();
    const { _id } = await getNote(database, id);
    // console.log({ noteFromDB })
    expect(_id).toEqual(id);
  });

  test("Update Note", async () => {
    const { id, ok } = await updateNote(database, note._id, updatedNote);
    expect(ok).toBeTruthy();
    const updatedNoteFromDB = await getNote(database, id);
    expect(updatedNoteFromDB._id).toEqual(note._id);
  });
});
