import { type DB, type BookData } from "./types";

export function upsertBook(db: DB, book: BookData) {
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
	const [res] = await db.execO<{
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
	}>(
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
	return {
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
	};
}
