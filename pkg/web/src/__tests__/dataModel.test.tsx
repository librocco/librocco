import { newNote, updateNote } from "../../db-actions";
import {
  database,
  note,
  databaseWithNote,
  updatedNote,
  databaseWithUpdatedNote,
} from "../__testData__/dataModel";

describe("Test data model", () => {
  test("New Note", () => {
    const newDB = newNote(database, note);
    expect(newDB).toEqual(databaseWithNote);
  });
  test("Update Note", () => {
    const newDB = updateNote(database, note._id, updatedNote);
    expect(newDB).toEqual(databaseWithUpdatedNote);
  });
});
