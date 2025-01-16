import { getReconciliationOrder, getReconciliationOrderLines } from "$lib/db/cr-sqlite/order-reconciliation";
import type { PageLoad } from "./$types";
import { getPlacedSupplierOrderLinesForReconciliation } from "$lib/db/cr-sqlite/suppliers";
import type { BookEntry } from "@librocco/db";

export const load: PageLoad = async ({ parent, params, depends }) => {
	depends("reconciliationOrder:data");

	const { ordersDb } = await parent();
	const reconciliationOrder = await getReconciliationOrder(ordersDb, parseInt(params.id));
	const reconciliationOrderLines = await getReconciliationOrderLines(ordersDb, parseInt(params.id));

	console.log({ reconciliationOrder });
	console.log({ reconciliationOrderLines });

	// we need a list of all the books
	// while going through them check if the isbn occurred twice
	const supplierOrderIds = JSON.parse(reconciliationOrder.supplier_order_ids) || [];

	const placedOrderLines = await getPlacedSupplierOrderLinesForReconciliation(ordersDb, supplierOrderIds);

	const supplierOrders = placedOrderLines.reduce<{ [supplier_order_id: string]: { supplier_name: string; supplier_id: string } }>(
		(acc, val) =>
			acc[val.supplier_order_id]
				? acc
				: { ...acc, [val.supplier_order_id]: { supplier_name: val.supplier_name, supplier_id: val.supplier_id } },
		{}
	);

	// const books: string[] = JSON.parse(reconciliationOrder.customer_order_line_ids) || [];
	const books = reconciliationOrderLines.map((recon) => recon.isbn);
	let mergedBookData = [];
	if (books.length) {
		const fetchedBookData = await ordersDb.execO<BookEntry>(`SELECT *
	FROM book WHERE isbn IN (${books.join(", ")})`);

		mergedBookData = books.map((book) => {
			//add empty string for supplier id
			return fetchedBookData.find((bookD) => bookD.isbn === book) || { isbn: book };
		});
	}

	return { reconciliationOrder, ordersDb, mergedBookData, placedOrderLines, supplierOrders, reconciliationOrderLines };
};

export const ssr = false;
