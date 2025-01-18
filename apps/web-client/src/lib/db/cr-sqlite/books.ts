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
 * @param {BookData} book - Book metadata
 * @throws {Error} If ISBN is not provided
 * @returns {Promise<void>} Resolves when book is created/updated
 */
export async function upsertBook(db: DB, book: BookData) {
	if (!book.isbn) {
		throw new Error("Book must have an ISBN");
	}
	const updatedAt = Object.keys(book).length > 1 ? Date.now() : null;
	return db.exec(
		`INSERT INTO book (isbn, title, authors, publisher, price, year, edited_by, out_of_print, category, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(isbn) DO UPDATE SET
            title = COALESCE(?, title),
            authors = COALESCE(?, authors),
            publisher = COALESCE(?, publisher),
            price = COALESCE(?, price),
            year = COALESCE(?, year),
            edited_by = COALESCE(?, edited_by),
            out_of_print = COALESCE(?, out_of_print),
			updated_at = COALESCE(?, updated_at),
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
			updatedAt,
			book.title,
			book.authors,
			book.publisher,
			book.price,
			book.year,
			book.editedBy,
			Number(book.outOfPrint),
			book.category,
			updatedAt
		]
	);
}

export async function getBookData(db: DB, isbn: string): Promise<Required<BookData> & { updatedAt: Date | null }> {
	const [res] = await db.execO<RawBookRes>(
		`SELECT
				isbn,
				COALESCE(title, '') as title,
				COALESCE(authors, '') as authors,
				COALESCE(publisher, '') as publisher,
				COALESCE(price, 0) as price,
				COALESCE(year, '') as year,
				COALESCE(edited_by, '') as editedBy,
				COALESCE(out_of_print, 0) as outOfPrint,
				COALESCE(category, '') as category,
				updated_at as updatedAt
			FROM book
			WHERE isbn = ?`,
		[isbn]
	);
	if (!res) {
		return undefined;
	}
	return processRawBookRes(res);
}

export async function getPublisherList(db: DB): Promise<string[]> {
	const res = await db.execO<{ publisher: string }>(`SELECT DISTINCT publisher FROM book`);
	return res.map(({ publisher }) => publisher);
}

export async function searchBooks(db: DB, searchString: string): Promise<Required<BookData>[]> {
	// Encode the search string for this (naive) query
	const filters = [`%${searchString}%`, `%${searchString}%`, `%${searchString}%`]; // One value for each ?

	const res = await db.execO<RawBookRes>(
		`
			SELECT
				isbn,
				COALESCE(title, '') as title,
				COALESCE(authors, '') as authors,
				COALESCE(publisher, '') as publisher,
				COALESCE(price, 0) as price,
				COALESCE(year, '') as year,
				COALESCE(edited_by, '') as editedBy,
				COALESCE(out_of_print, 0) as outOfPrint,
				COALESCE(category, '') as category,
				updated_at as updatedAt
			FROM book
			WHERE isbn LIKE ? OR title LIKE ? OR authors LIKE ?
			ORDER BY isbn ASC
		`,
		filters
	);

	return res.map(processRawBookRes);
}

// #region utils
type RawBookRes = {
	isbn: string;
	title: string;
	authors: string;
	publisher: string;
	price: number;
	year: string;
	editedBy: string;
	outOfPrint: number;
	category: string;
	updatedAt: number;
};

const processRawBookRes = (res: RawBookRes): Required<BookData> & { updatedAt: Date | null } => ({
	isbn: res.isbn,
	title: res.title,
	authors: res.authors,
	publisher: res.publisher,
	price: res.price,
	year: res.year,
	editedBy: res.editedBy,
	outOfPrint: Boolean(res.outOfPrint),
	category: res.category,
	updatedAt: res.updatedAt ? new Date(res.updatedAt) : null
});
