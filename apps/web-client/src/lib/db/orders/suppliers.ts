import type { DB, Supplier, SupplierOrderInfo, SupplierOrderLine, SupplierOrder } from "./types";

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
		[
			supplier.id,
			supplier.name ?? null,
			supplier.email ?? null,
			supplier.address ?? null,
			supplier.name ?? null,
			supplier.email ?? null,
			supplier.address ?? null
		]
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
      WHERE quantity > 0 AND placed is NULL
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
       WHERE quantity > 0 AND placed is NULL
       GROUP BY supplier.name, supplier_id
       ORDER BY book.isbn ASC;`
	);
	return result;
}

export async function createSupplierOrder(db: DB, orderLines: SupplierOrderLine[]): Promise<SupplierOrder[]> {
	// Creates one or more supplier orders with the given order lines. Updates customer order lines to reflect the order.
	// Returns one or more `SupplierOrder` as they would be returned by `getSupplierOrder`
	const supplierOrderMapping = {};
	// Collect all supplier ids involved in the order lines
	const supplierIds = Array.from(new Set(orderLines.map((item) => item.supplier_id)));
	await db.tx(async (passedDb) => {
		const db: DB = passedDb as DB;
		for (const supplierId of supplierIds) {
			// Create a new supplier order for each supplier
			const newId = (
				await db.execA(
					`INSERT INTO supplier_order (supplier_id)
			      VALUES (?) RETURNING id;`,
					[supplierId]
				)
			)[0][0];
			// Save the newly created supplier order id
			supplierOrderMapping[supplierId] = newId;
		}

		for (const orderLine of orderLines) {
			// Find the customer order lines corresponding to this supplier order line
			const customerOrderLines = await db.execO<any>(
				`SELECT id, isbn, quantity FROM customer_order_lines WHERE isbn = ? AND placed is NULL`,
				[orderLine.isbn]
			);
			let copiesToGo = orderLine.quantity;
			while (copiesToGo > 0) {
				const line = customerOrderLines.shift();
				if (line.quantity <= copiesToGo) {
					// The whole line can be fulfilled
					await db.exec(`UPDATE customer_order_lines SET placed = (strftime('%s', 'now') * 1000) WHERE id = ?;`, [line.id]);
					copiesToGo -= line.quantity;
				} else {
					// Only part of the line can be fulfilled: split the existing order line
					throw new Error("Not implemented");
				}
			}
			await db.exec(
				`INSERT INTO supplier_order_line (supplier_order_id, isbn, quantity)
	      VALUES (?, ?, ?);`,
				[supplierOrderMapping[orderLine.supplier_id], orderLine.isbn, orderLine.quantity]
			);
		}
	});
	return Promise.all(supplierIds.map((supplierId) => getSupplierOrder(db, supplierOrderMapping[supplierId])));
}

export async function getSupplierOrder(db: DB, supplierOrderId: number): Promise<SupplierOrder> {
	const orderInfo = await db.execO<any>(
		`SELECT supplier_order.id as supplier_order_id, created, supplier_id, supplier.name as supplier_name, isbn, quantity
       FROM supplier_order
         JOIN supplier ON supplier_order.supplier_id = supplier.id
         JOIN supplier_order_line ON supplier_order.id = supplier_order_line.supplier_order_id
       WHERE supplier_order.id = ?;`,
		[supplierOrderId]
	);
	const result = { supplier_id: orderInfo[0].supplier_id, created: new Date(orderInfo[0].created) };
	result.lines = orderInfo.map((line) => {
		return { supplier_id: line.supplier_id, isbn: line.isbn, quantity: line.quantity };
	});
	return result;
}
