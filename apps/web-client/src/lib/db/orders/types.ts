/**
 * This is a placeholder as we're not using the generic DB, this might change as we add schema, but trying to keep this as a single source of truth
 */
export { type DB } from "@vlcn.io/crsqlite-wasm";

export type Customer = {
	id?: number;
	fullname?: string;
	email?: string;
	deposit?: number;
};

export type CustomerOrderLine = { id: number; isbn: string; quantity: number };
export type Book = { isbn: string; quantity: number };
