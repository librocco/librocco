import { describe, it, expect, beforeEach } from "vitest";

import { type DB } from "../types";

import { getRandomDb, createCustomerOrders } from "./lib";

import { associatePublisher, getPossibleSupplerOrderLines, getPossibleSupplerOrderInfos, createSupplierOrder } from "../suppliers";

describe("Suppliers order creation", () => {
	let db: DB;
	beforeEach(async () => {
		db = await getRandomDb();
		await createCustomerOrders(db);
	});

	it("sees possible supplier orders from client orders", async () => {
		expect(await getPossibleSupplerOrderLines(db)).toStrictEqual([
			{ supplier_id: 1, isbn: "1", quantity: 1 },
			{ supplier_id: 1, isbn: "2", quantity: 1 },
			{ supplier_id: 2, isbn: "3", quantity: 2 }
		]);
		expect(await getPossibleSupplerOrderInfos(db)).toStrictEqual([
			{ supplier_name: "Science Books LTD", supplier_id: 1, total_book_number: 2, total_book_price: 20 },
			{ supplier_name: "Phantasy Books LTD", supplier_id: 2, total_book_number: 2, total_book_price: 10 }
		]);
		// If we change the supplier for ChemPub to Phantasy Books LTD
		// the supplier order will reflect that
		await associatePublisher(db, 2, "ChemPub");
		expect(await getPossibleSupplerOrderLines(db)).toStrictEqual([
			{ supplier_id: 1, isbn: "1", quantity: 1 },
			{ supplier_id: 2, isbn: "2", quantity: 1 }, // This is now from supplier 2
			{ supplier_id: 2, isbn: "3", quantity: 2 }
		]);
	});
	it.only("creates two new supplier orders", async () => {
		const possibleOrderLines = await getPossibleSupplerOrderLines(db);
		const newOrders = await createSupplierOrder(db, possibleOrderLines);
		expect(newOrders.length).toStrictEqual(2);
		const newPossibleOrderLines = await getPossibleSupplerOrderLines(db);
		expect(newPossibleOrderLines.length).toStrictEqual(0);
	});
});
