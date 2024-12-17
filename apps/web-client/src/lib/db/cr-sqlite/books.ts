import { type DB } from "./types";

export type Book = {
	isbn: string;
	title?: string;
	authors?: string;
	publisher?: string;
	price?: number;
};

export async function upsertBook(db: DB, book: Book) {
	if (!book.isbn) {
		throw new Error("Book must have ann ISBN");
	}
	await db.exec(
		`INSERT INTO book (isbn, title, authors, publisher, price)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(isbn) DO UPDATE SET
            title = COALESCE(?, title),
            authors = COALESCE(?, authors),
            publisher = COALESCE(?, publisher),
            price = COALESCE(?, price);`,
		[book.isbn, book.title, book.authors, book.publisher, book.price, book.title, book.authors, book.publisher, book.price]
	);
}
