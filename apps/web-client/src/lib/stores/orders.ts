import { writable } from "svelte/store";
import type { Customer, CustomerOrderLine } from "$lib/db/orders/types";

export const customer = writable<{ customerDetails: Customer; customerBooks: CustomerOrderLine[] }>();

export const customerOrders = writable<{ customers: Customer[] }>();
