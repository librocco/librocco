import { writable, derived } from "svelte/store";
import type { Customer, CustomerOrderLine } from "$lib/db/orders/types";
import type { BookEntry } from "@librocco/db";
import { upsertCustomer } from "$lib/db/orders/customers";
import type { DB } from "$lib/db/orders/types";

export const currentCustomer = writable<{ customerDetails: Customer; customerBooks: (CustomerOrderLine & BookEntry)[] }>();
export const currentDB = writable<DB | null>(null);
export const customers = writable<Customer[]>();
export const customerOrders = derived([currentCustomer, customers, currentDB], ([$currentCustomer, $customers, $currentDB]) => {
	const index = $customers.findIndex(
		(cus) => $currentCustomer && $currentCustomer.customerDetails && cus.id === $currentCustomer.customerDetails.id
	);

	if (index !== -1 && $currentDB) {
		upsertCustomer($currentDB, $currentCustomer.customerDetails);
		const updatedCustomers = [...$customers];
		updatedCustomers[index] = $currentCustomer.customerDetails;
		return updatedCustomers;
	}
	return $customers;
});
