import type { DB, Supplier, SupplierOrderInfo, SupplierOrderLine } from "./types";

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

export async function getPublishersFor(db: DB, supplierId: number): Promise<string[]> {
	const result = await db.execA("SELECT publisher FROM supplier_publisher WHERE supplier_id = ?;", [supplierId]);
	if (result.length > 0) {
		return result[0];
	}
	return [];
}

export async function associatePublisher(db: DB, supplierId: number, publisherId: string) {
	/* Makes sure the given publisher is associated with the given supplier id.
     If necessary it disassociates a different supplier */
	await db.exec(
		`INSERT INTO supplier_publisher (supplier_id, publisher)
         VALUES (?, ?)
         ON CONFLICT(publisher) DO UPDATE SET
           supplier_id = ?;`,
		[supplierId, publisherId, supplierId]
	);
}

export async function getPossibleSupplerOrderLines(db: DB): Promise<SupplierOrderLine[]> {
	// We need to build a query that will yield all books we can order, grouped by supplier
	const result = await db.execO<{ supplier_id: number; isbn: string; quantity: number }>(
		`SELECT supplier_id, book.isbn, SUM(quantity) as quantity
      FROM supplier
        JOIN supplier_publisher ON supplier.id = supplier_publisher.supplier_id
        JOIN book ON supplier_publisher.publisher = book.publisher
        JOIN customer_order_lines ON book.isbn = customer_order_lines.isbn
      WHERE quantity > 0
      GROUP BY supplier_id, book.isbn
      ORDER BY book.isbn ASC;`
	);
	return result;
}

export async function getPossibleSupplerOrderInfos(db: DB): Promise<SupplierOrderInfo[]> {
	const result = await db.execO<SupplierOrderInfo>(
		`SELECT supplier.name as supplier_name, supplier_id, SUM(quantity) as total_book_number, SUM(quantity * price) as total_book_price
       FROM supplier
         JOIN supplier_publisher ON supplier.id = supplier_publisher.supplier_id
         JOIN book ON supplier_publisher.publisher = book.publisher
         JOIN customer_order_lines ON book.isbn = customer_order_lines.isbn
       WHERE quantity > 0
       GROUP BY supplier.name, supplier_id
       ORDER BY book.isbn ASC;`
	);
	return result;
}

// export async function createSupplierOrder(db: DB, orderLines: SupplierOrderLine[]): Promise<SupplierOrder> {
// 	/* Creates a new supplier order with the given order lines. Updates customer order lines to reflect the order.
// 	  Returns the orderinfo as it would be returned by `getSupplierOrder`
// 	 */
// }
