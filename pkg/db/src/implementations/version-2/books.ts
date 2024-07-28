import { firstValueFrom, map, Observable } from "rxjs";

import { BookEntry, BooksInterface } from "@/types";
import { InventoryDatabaseInterface } from "./types";

import { observableFromStore } from "@/helpers";

export const createBooksInterface = (db: InventoryDatabaseInterface): BooksInterface => {
	const streamed = (isbns: string[]) =>
		observableFromStore(db.replicated((db) => db.selectFrom("books").where("isbn", "in", isbns).selectAll()));

	const publishers = () =>
		db.replicated((db) =>
			db.selectFrom("books").distinctOn("publisher").select("publisher").where("publisher", "!=", "").where("publisher", "!=", null)
		);

	const upsert = async (books: Partial<BookEntry>[]) => {
		const values = books.filter((b): b is BookEntry => !!b.isbn).map((book) => ({ ...book, updatedAt: new Date().toISOString() }));
		await db.update((db) =>
			db
				.insertInto("books")
				.values(values)
				.onConflict((oc) =>
					oc.column("isbn").doUpdateSet((du) => {
						// Update only the specified fields on conflict
						return Object.fromEntries(
							[
								["isbn", du.ref("excluded.isbn")],
								["authors", du.ref("excluded.authors")],
								["category", du.ref("excluded.category")],
								["editedBy", du.ref("excluded.editedBy")],
								["outOfPrint", du.ref("excluded.outOfPrint")],
								["price", du.ref("excluded.price")],
								["publisher", du.ref("excluded.publisher")],
								["title", du.ref("excluded.title")],
								["updatedAt", du.ref("excluded.updatedAt")],
								["year", du.ref("excluded.year")]
							].filter(([, ref]) => ref !== undefined && ref !== null)
						);
					})
				)
				.execute()
		);
	};

	return {
		get: (isbns: string[]) => firstValueFrom(streamed(isbns)),
		stream: (_, isbns) => streamed(isbns),
		// Publishers will always be non empty strings (validated at query level)
		streamPublishers: () => observableFromStore(publishers()).pipe(map((p) => p.map(({ publisher }) => publisher as string))),
		upsert,
		// TODO
		streamSearchIndex: () => new Observable()
	};
};
