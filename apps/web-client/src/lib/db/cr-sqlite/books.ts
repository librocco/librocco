/**
 * @fileoverview Book management system
 *
 * Book Overview:
 * - Manages book metadata in the system (ISBN, title, price, etc.)
 * - Books are the core entities that can be moved between warehouses
 * - Book records are referenced by transactions in notes
 * - Book data includes:
 *   - ISBN (unique identifier)
 *   - Title
 *   - Authors
 *   - Publisher (used to associate the book with a supplier)
 *   - Price
 *   - Year
 *   - Editor
 *   - Out of print status
 *   - Category
 *
 */

import { type DB, type BookData } from "./types";

/**
 * Creates a new book record or updates an existing one.
 * Uses ISBN as the unique identifier for upsert operations.
 * All fields except ISBN are optional and will only be updated if provided.
 *
 * @param {DB} db - Database connection
 * @param {BookData} book - Book metadata including:
 *   - isbn: Unique identifier (required)
 *   - title: Book title
 *   - authors: Author names
 *   - publisher: Publishing company
 *   - price: Book price
 *   - year: Publication year
 *   - editedBy: Editor name
 *   - outOfPrint: Whether book is out of print
 *   - category: Book category/genre
 * @throws {Error} If ISBN is not provided
 * @returns {Promise<void>} Resolves when book is created/updated
 */
export async function upsertBook(db: DB, book: BookData) {
	if (!book.isbn) {
		throw new Error("Book must have an ISBN");
	}
	await db.exec(
		`INSERT INTO book (isbn, title, authors, publisher, price, year, edited_by, out_of_print, category)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(isbn) DO UPDATE SET
            title = COALESCE(?, title),
            authors = COALESCE(?, authors),
            publisher = COALESCE(?, publisher),
            price = COALESCE(?, price),
            year = COALESCE(?, year),
            edited_by = COALESCE(?, edited_by),
            out_of_print = COALESCE(?, out_of_print),
            category = COALESCE(?, category);`,
		[
			book.isbn,
			book.title,
			book.authors,
			book.publisher,
			book.price,
			book.year,
			book.editedBy,
			Number(book.outOfPrint),
			book.category,
			book.title,
			book.authors,
			book.publisher,
			book.price,
			book.year,
			book.editedBy,
			Number(book.outOfPrint),
			book.category
		]
	);
}
