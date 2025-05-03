import { describe, it, expect } from "vitest";

import { getRandomDb } from "./lib";

import { getBookData, upsertBook } from "../books";

describe("upsertBook should", () => {
	it("create a new book with all fields", async () => {
		const db = await getRandomDb();

		const book = {
			isbn: "1111111111",
			title: "The Hobbit",
			authors: "J.R.R. Tolkien",
			year: "1937",
			category: "Fantasy",
			editedBy: "George Allen & Unwin",
			publisher: "George Allen & Unwin",
			outOfPrint: false,
			price: 10.0
		};

		await upsertBook(db, book);

		expect(await getBookData(db, book.isbn)).toEqual({ ...book, updatedAt: expect.any(Date) });
	});

	it("not set updatedAt if no fields other than ISBN are found", async () => {
		const db = await getRandomDb();

		const book = {
			isbn: "1111111111"
		};

		await upsertBook(db, book);

		const res = await getBookData(db, book.isbn);
		expect(res).toMatchObject({ isbn: book.isbn });
		// NOTE: if there's not additional data whatsoever, updatedAt is not set
		// This is used to signal whether or not the book data was fetched of manually filled in, or merely and ISBN only entry added to the DB
		expect(res.updatedAt).toBeFalsy();
	});

	it("add the updatedAt field if at least one additional field (other than ISBN) was provided", async () => {
		const db = await getRandomDb();

		const book = {
			isbn: "1111111111",
			title: "The Hobbit"
		};

		await upsertBook(db, book);

		const res = await getBookData(db, book.isbn);
		expect(res).toMatchObject({ ...book, updatedAt: expect.any(Date) });
	});

	it("update full book data", async () => {
		const db = await getRandomDb();

		const book1 = {
			isbn: "1111111111",
			title: "The Hobbit",
			authors: "J.R.R. Tolkien",
			year: "1937",
			category: "Fantasy",
			editedBy: "George Allen & Unwin",
			publisher: "George Allen & Unwin",
			outOfPrint: false,
			price: 10.0
		};

		const book2 = {
			isbn: "1111111111",
			title: "The Lord of the Rings",
			authors: "J.R.R. Tolkien",
			year: "1954",
			category: "Fantasy",
			editedBy: "George Allen & Unwin",
			publisher: "George Allen & Unwin",
			outOfPrint: true,
			price: 20.0
		};

		// Create the book
		await upsertBook(db, book1);
		// Update the book
		await upsertBook(db, book2);

		expect(await getBookData(db, book1.isbn)).toEqual({ ...book2, updatedAt: expect.any(Date) });
	});

	it("partially update the book data (leaving the rest intact + updating updatedAt)", async () => {
		const db = await getRandomDb();

		const book = {
			isbn: "1111111111",
			title: "The Hobbit",
			authors: "J.R.R. Tolkien",
			year: "1937",
			category: "Fantasy",
			editedBy: "George Allen & Unwin",
			publisher: "George Allen & Unwin",
			outOfPrint: false,
			price: 10.0
		};

		// Create the book
		await upsertBook(db, book);

		const res1 = await getBookData(db, book.isbn);
		const updatedAt1 = res1.updatedAt;

		// Update the book
		await upsertBook(db, { isbn: book.isbn, price: 20 });

		const res2 = await getBookData(db, book.isbn);
		expect(res2).toEqual({ ...book, price: 20, updatedAt: expect.any(Date) });
		const updatedAt2 = res2.updatedAt;

		expect(updatedAt2 > updatedAt1).toBe(true);
	});

	it("add the updatedAt field if updating ISBN-only entry with some additinal fields", async () => {
		const db = await getRandomDb();

		const book = {
			isbn: "1111111111"
		};

		// Create the book
		await upsertBook(db, book);

		// Update the book
		await upsertBook(db, { isbn: book.isbn, price: 20 });

		expect(await getBookData(db, book.isbn)).toMatchObject({ updatedAt: expect.any(Date) });
	});
});

// TODO: test the rest of the book module
