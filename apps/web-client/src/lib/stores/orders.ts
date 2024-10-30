import { writable, derived } from "svelte/store";
import type { Customer, CustomerOrderLine } from "$lib/db/orders/types";

export const currentCustomer = writable<{ customerDetails: Customer; customerBooks: CustomerOrderLine[] }>();

export const customers = writable<Customer[]>();
export const customerOrders = derived([currentCustomer, customers], ([$currentCustomer, $customers]) => {
	const index = $customers.findIndex(
		(cus) => $currentCustomer && $currentCustomer.customerDetails && cus.id === $currentCustomer.customerDetails.id
	);

	if (index !== -1) {
		const updatedCustomers = [...$customers];
		updatedCustomers[index] = $currentCustomer.customerDetails;
		return updatedCustomers;
	}
	return $customers;
});
