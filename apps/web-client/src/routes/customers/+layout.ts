import { getInitializedDB } from "$lib/db/orders";
import { getAllCustomers } from "$lib/db/orders/customers";
import { upsertBook } from "$lib/db/orders/books";

import { customers } from "$lib/stores/orders";

export const load = async () => {
	const ordersDb = await getInitializedDB("librocco-current-db");

	const allCustomers = await getAllCustomers(ordersDb);

	await upsertBook(ordersDb, { isbn: "111", publisher: "MathsAndPhysicsPub", title: "Physics", price: 7 });
	await upsertBook(ordersDb, { isbn: "222", publisher: "ChemPub", title: "Chemistry", price: 13 });
	await upsertBook(ordersDb, { isbn: "333", publisher: "PhantasyPub", title: "The Hobbit", price: 5 });

	customers.set(allCustomers);
	return { ordersDb };
};

export const ssr = false;
