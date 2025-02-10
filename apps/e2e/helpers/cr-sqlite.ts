import type { DB } from "@vlcn.io/crsqlite-wasm";
import { Customer, PlacedSupplierOrder, PlacedSupplierOrderLine, Supplier, SupplierOrderLine } from "./types";

// #region books

export type BookData = {
	isbn: string;
	title?: string;
	price?: number;
	year?: string;
	authors?: string;
	publisher?: string;
	editedBy?: string;
	outOfPrint?: boolean;
	category?: string;
};

export async function upsertBook(db: DB, book: BookData) {
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

// #region warehouse

export type Warehouse = {
	id: number;
	displayName?: string | null;
	discount?: number | null;
};

export function upsertWarehouse(db: DB, data: Warehouse): Promise<void> {
	if (!data.id) {
		throw new Error("Warehouse must have an id");
	}

	return db.tx(async (txDb) => {
		const { id, displayName = null, discount = null } = data;

		const query = `
        INSERT INTO warehouse (id, display_name, discount)
        VALUES (?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            display_name = COALESCE(?, display_name),
            discount = COALESCE(?, discount);
    `;
		await txDb.exec(query, [id, displayName, discount, displayName, discount]);
	});
}

// #region notes

export function createInboundNote(db: DB, params: { id: number; warehouseId: number; displayName?: string }): Promise<void> {
	const { warehouseId, id: noteId, displayName = "New Note" } = params;

	const timestamp = Date.now();
	const stmt = "INSERT INTO note (id, display_name, warehouse_id, updated_at) VALUES (?, ?, ?, ?)";

	return db.exec(stmt, [noteId, displayName, warehouseId, timestamp]);
}

export function createOutboundNote(db: DB, params: { id: number; displayName?: string }): Promise<void> {
	const { id: noteId, displayName = "New Note" } = params;

	const timestamp = Date.now();
	const stmt = "INSERT INTO note (id, display_name, updated_at) VALUES (?, ?, ?)";

	return db.exec(stmt, [noteId, displayName, timestamp]);
}

export async function updateNote(db: DB, payload: { id: number; displayName?: string; defaultWarehouse?: number }): Promise<void> {
	const { id, displayName, defaultWarehouse } = payload;

	const updateFields = [];
	const updateValues: (string | number)[] = [];

	if (displayName !== undefined) {
		updateFields.push("display_name = ?");
		updateValues.push(displayName);
	}

	if (defaultWarehouse !== undefined) {
		updateFields.push("default_warehouse = ?");
		updateValues.push(defaultWarehouse);
	}

	if (updateFields.length === 0) {
		return;
	}

	updateFields.push("updated_at = ?");
	updateValues.push(Date.now());

	const updateQuery = `
		UPDATE note
		SET ${updateFields.join(", ")}
		WHERE id = ?
	`;

	updateValues.push(id);

	return db.exec(updateQuery, updateValues);
}

// #region note-txns

type VolumeStock = {
	isbn: string;
	quantity: number;
	warehouseId?: number;
};

export async function addVolumesToNote(db: DB, params: readonly [noteId: number, volume: VolumeStock]): Promise<void> {
	const [noteId, volume] = params;

	const { isbn, quantity, warehouseId } = volume;

	const timestamp = Date.now();

	const keys = ["note_id", "isbn", "quantity", "updated_at"];
	const values = [noteId, isbn, quantity, timestamp];

	if (warehouseId) {
		keys.push("warehouse_id");
		values.push(warehouseId);
	}

	const insertOrUpdateTxnQuery = `
		INSERT INTO book_transaction (${keys.join(", ")})
		VALUES (${keys.map(() => "?").join(", ")})
		ON CONFLICT(isbn, note_id, warehouse_id) DO UPDATE SET
			quantity = book_transaction.quantity + excluded.quantity,
			updated_at = excluded.updated_at
	`;

	await db.tx(async (txDb) => {
		await txDb.exec(insertOrUpdateTxnQuery, values);
		await txDb.exec(`UPDATE note SET updated_at = ? WHERE id = ?`, [timestamp, noteId]);
	});
}

export type NoteCustomItem = { id: number; title: string; price: number };

export async function upsertNoteCustomItem(db: DB, params: readonly [noteId: number, item: NoteCustomItem]): Promise<void> {
	const [noteId, item] = params;
	const { id, title, price } = item;

	const timestamp = Date.now();

	const query = `
		INSERT INTO custom_item(id, note_id, title, price, updated_at)
		VALUES(?, ?, ?, ?, ?)
		ON CONFLICT(id, note_id) DO UPDATE SET
			title = excluded.title,
			price = excluded.price,
			updated_at = excluded.updated_at
	`;

	await db.exec(query, [id, noteId, title, price, timestamp]);
}

export async function commitNote(db: DB, id: number): Promise<void> {
	return db.exec("UPDATE note SET committed = 1, committed_at = ? WHERE id = ?", [Date.now(), id]);
}

// #region customerOrders

export async function upsertCustomer(db: DB, customer: Customer) {
	if (!customer.id) {
		throw new Error("Customer must have an id");
	}

	if (!customer.displayId) {
		throw new Error("Customer must have a displayId");
	}

	const timestamp = Date.now();

	await db.exec(
		`INSERT INTO customer (id, fullname, email, deposit, display_id, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           fullname = COALESCE(?, fullname),
           email = COALESCE(?, email),
           deposit = COALESCE(?, deposit),
           display_id = COALESCE(?, display_id),
           updated_at = ?
		   `,
		[
			customer.id,
			customer.fullname ?? null,
			customer.email ?? null,
			customer.deposit ?? null,
			customer.displayId,
			timestamp,
			customer.fullname ?? null,
			customer.email ?? null,
			customer.deposit ?? null,
			customer.displayId,
			timestamp
		]
	);
}

export const addBooksToCustomer = async (db: DB, params: { customerId: number; bookIsbns: string[] }): Promise<void> => {
	const multiplyString = (str: string, n: number) => Array(n).fill(str).join(", ");
	const { customerId, bookIsbns } = params;
	const sqlParams = bookIsbns.map((isbn) => [customerId, isbn]).flat();
	const sql = `
     INSERT INTO customer_order_lines (customer_id, isbn)
     VALUES ${multiplyString("(?,?)", bookIsbns.length)} RETURNING customer_id;`;

	const id = await db.exec(sql, sqlParams);
	console.log({ id });
};

// #endregion customerOrders

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
		[supplier.id, supplier.name ?? null, supplier.email ?? null, supplier.address ?? null]
	);
}

export async function associatePublisher(db: DB, params: { supplierId: number; publisherId: string }): Promise<void> {
	const { publisherId, supplierId } = params;
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

export async function createSupplierOrder(db: DB, orderLines: SupplierOrderLine[]) {
	/** @TODO Rewrite this function to accomodate for removing quantity in customerOrderLine */
	// Creates one or more supplier orders with the given order lines. Updates customer order lines to reflect the order.
	// Returns one or more `SupplierOrder` as they would be returned by `getSupplierOrder`

	const supplierOrderMapping: { [supplierId: number]: number } = {};
	// Collect all supplier ids involved in the order lines
	const supplierIds = Array.from(new Set(orderLines.map((item) => item.supplier_id)));

	await db.tx(async (passedDb) => {
		const db: DB = passedDb as DB;
		for (const supplierId of supplierIds) {
			// Create a new supplier order for each supplier
			const newSupplierOrderId = (
				await db.execA<number[]>(
					`INSERT INTO supplier_order (supplier_id)
			      VALUES (?) RETURNING id;`,
					[supplierId]
				)
			)[0][0];
			// Save the newly created supplier order id
			supplierOrderMapping[supplierId] = newSupplierOrderId;
		}

		for (const orderLine of orderLines) {
			// Find the customer order lines corresponding to this supplier order line
			const customerOrderLines = await db.execO<any>(
				// TODO: write tests to check the sorting by order creation
				`SELECT id, isbn FROM customer_order_lines WHERE isbn = ? AND placed is NULL ORDER BY created ASC;`,
				[orderLine.isbn]
			);

			let copiesToGo = orderLine.quantity;
			while (copiesToGo > 0) {
				const customerOrderLine = customerOrderLines.shift();
				if (customerOrderLine) {
					// The whole line can be fulfilled
					await db.exec(`UPDATE customer_order_lines SET placed = (strftime('%s', 'now') * 1000) WHERE id = ?;`, [customerOrderLine.id]);
				}
				copiesToGo--;
			}
			await db.exec(
				`INSERT INTO supplier_order_line (supplier_order_id, isbn, quantity)
	      VALUES (?, ?, ?);`,
				[supplierOrderMapping[orderLine.supplier_id], orderLine.isbn, orderLine.quantity]
			);
		}
	});
}
export async function createReconciliationOrder(db: DB, supplierOrderIds: number[]): Promise<number> {
	const multiplyString = (str: string, n: number) => Array(n).fill(str).join(", ");

	if (!supplierOrderIds.length) {
		throw new Error("Reconciliation order must be based on at least one supplier order");
	}

	const recondOrder = await db.execO<{ id: number }>(
		`INSERT INTO reconciliation_order (supplier_order_ids) VALUES (json_array(${multiplyString(
			"?",
			supplierOrderIds.length
		)})) RETURNING id;`,
		supplierOrderIds
	);
	return recondOrder[0].id;
}
export async function getPlacedSupplierOrders(db: DB): Promise<PlacedSupplierOrder[]> {
	const result = await db.execO<PlacedSupplierOrder>(
		`SELECT
            so.id,
            so.supplier_id,
            s.name as supplier_name,
            so.created,
            COALESCE(SUM(sol.quantity), 0) as total_book_number,
			SUM(COALESCE(book.price, 0) * sol.quantity) as total_book_price
        FROM supplier_order so
        JOIN supplier s ON s.id = so.supplier_id
		LEFT JOIN supplier_order_line sol ON sol.supplier_order_id = so.id
		LEFT JOIN book ON sol.isbn = book.isbn
        WHERE so.created IS NOT NULL
        GROUP BY so.id, so.supplier_id, s.name, so.created
        ORDER BY so.created DESC;`
	);
	return result;
}
export async function getPlacedSupplierOrderLines(db: DB, supplier_order_ids: number[]): Promise<PlacedSupplierOrderLine[]> {
	if (!supplier_order_ids.length) {
		return [];
	}
	const multiplyString = (str: string, n: number) => Array(n).fill(str).join(", ");

	const query = `
        SELECT
            sol.supplier_order_id,
            sol.isbn,
            sol.quantity,
			COALESCE(book.price, 0) * sol.quantity as line_price,
			COALESCE(book.title, 'N/A') AS title,
			COALESCE(book.authors, 'N/A') AS authors,
            so.supplier_id,
            so.created,
            s.name AS supplier_name,
            SUM(sol.quantity) OVER (PARTITION BY sol.supplier_order_id) AS total_book_number,
            SUM(COALESCE(book.price, 0) * sol.quantity) OVER (PARTITION BY sol.supplier_order_id) AS total_book_price
		FROM supplier_order_line AS sol
		LEFT JOIN book ON sol.isbn = book.isbn
        JOIN supplier_order so ON so.id = sol.supplier_order_id
        JOIN supplier s ON s.id = so.supplier_id
        WHERE sol.supplier_order_id IN (${multiplyString("?", supplier_order_ids.length)})
		GROUP BY sol.supplier_order_id, sol.isbn
        ORDER BY sol.supplier_order_id, sol.isbn ASC;
    `;

	return db.execO<PlacedSupplierOrderLine>(query, supplier_order_ids);
}
