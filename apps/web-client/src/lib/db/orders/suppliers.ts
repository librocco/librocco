import { type DB } from "./types";

export type Supplier = {
	id?: number;
	name?: string;
	email?: string;
	address?: string;
};

export async function getAllSuppliers(db: DB): Promise<Supplier[]> {
	const result = await db.execO<Supplier>("SELECT id, name, email, address FROM supplier ORDER BY id ASC;");
	return result;
}

export async function upsertSupplier(db: DB, supplier: Supplier) {
	if (!supplier.id) {
		throw new Error("Supplier must have an id");
	}
	await db.exec(
		`INSERT INTO supplier (id, name, email, address)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           name = COALESCE(?, name),
           email = COALESCE(?, email),
           address = COALESCE(?, address);`,
		[supplier.id, supplier.name, supplier.email, supplier.address, supplier.name, supplier.email, supplier.address]
	);
}
