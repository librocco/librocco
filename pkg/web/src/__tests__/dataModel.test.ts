import { createDatabaseInterface } from "../../db-actions";
import { v4 as uuidv4 } from 'uuid';

// import {
//   createDatabaseInterface, Note
// } from "../../pouchdb-actions";

import { note, bookOne, bookTwo } from "../__testData__/dataModel";
const db = createDatabaseInterface(uuidv4());

describe("Test data model", () => {

  test("All database funcitonality", async () => {

    const { total_rows } = await db.getNotes()
    expect(total_rows).toEqual(0)
    const { id } = await db.newNote(note)
    const { total_rows: n } = await db.getNotes()
    expect(n).toEqual(1)

    const noBooksNote = await db.listBooks(id)

    expect(noBooksNote).toHaveLength(0)
    await db.addBook(id, bookOne)

    const booksNote = await db.listBooks(id)
    expect(booksNote).toHaveLength(1)

    await db.addBook(id, bookTwo)

    const moreBooksNote = await db.listBooks(id)
    expect(moreBooksNote).toHaveLength(2)

    await db.removeBook(id, bookOne.isbn)
    const lessBooksNote = await db.listBooks(id)
    expect(lessBooksNote).toHaveLength(1)
    expect(lessBooksNote).toContainEqual(bookTwo)


    const removeBookOne = db.removeBook(id, bookOne.isbn)
    await expect(() => removeBookOne).rejects.toThrow("Book does not exist")

    const addBookTwoAgain = db.addBook(id, bookTwo)

    await expect(() => addBookTwoAgain).rejects.toThrow("Book already exists")  
  })
});
