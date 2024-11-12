import { describe, it, expect, beforeEach } from "vitest";

import { type DB } from "../types";

import { getRandomDb, createCustomerOrders } from "./lib";

import {
	getAllReconciliationOrders,
	createReconciliationOrder,
	getReconciliationOrder,
	updateReconciliationOrder
} from "../reconciliation";
import { createSupplierOrder, getPossibleSupplerOrderLines } from "../suppliers";

//getAllReconciliationOrders

describe("Suppliers order creation", () => {
	let db: DB;
	beforeEach(async () => {
		db = await getRandomDb();
		await createCustomerOrders(db);
	});

	it("can get all currently reconciliating orders", async () => {
		const res = await getAllReconciliationOrders(db);
		expect(res).toStrictEqual([]);
		// get supplier orders
		const supplierOrders = await createSupplierOrder(db, await getPossibleSupplerOrderLines(db));

		const ids = supplierOrders.map((supplierOrder) => supplierOrder.id.toString());

		// use supplier order ids to create a recon
		await createReconciliationOrder(db, ids);
		const res2 = await getAllReconciliationOrders(db);

		expect(res2).toMatchObject([
			{
				customer_order_line_ids: null,
				id: 1,
				supplier_order_ids: "1, 2"
			}
		]);
	});
	it("can create a reconciliation order", async () => {
		const supplierOrders = await createSupplierOrder(db, await getPossibleSupplerOrderLines(db));

		const ids = supplierOrders.map((supplierOrder) => supplierOrder.id.toString());

		const reconOrderId = await createReconciliationOrder(db, ids);
		expect(reconOrderId).toStrictEqual(1);
		const res2 = await getReconciliationOrder(db, reconOrderId);

		expect(res2).toMatchObject({
			customer_order_line_ids: null,
			id: 1,
			supplier_order_ids: "1, 2"
		});
	});
	it("can update a currently reconciliating order", async () => {
		const supplierOrders = await createSupplierOrder(db, await getPossibleSupplerOrderLines(db));

		const ids = supplierOrders.map((supplierOrder) => supplierOrder.id.toString());

		const reconOrderId = await createReconciliationOrder(db, ids);
		expect(reconOrderId).toStrictEqual(1);
		const res2 = await getReconciliationOrder(db, reconOrderId);

		expect(res2).toMatchObject({
			customer_order_line_ids: null,
			id: 1,
			supplier_order_ids: "1, 2"
		});

		// const orderLines = (await getPossibleSupplerOrderLines(db)).map((line) => line.isbn);
		await updateReconciliationOrder(db, 1, ["123", "435", "324"]);

		const res3 = await getReconciliationOrder(db, reconOrderId);

		expect(res3).toMatchObject({
			customer_order_line_ids: "123, 435, 324",
			id: 1,
			supplier_order_ids: "1, 2"
		});
	});
});
