type Customer = {
	id?: number;
	fullname?: string;
	email?: string;
	deposit?: number;
};
type CustomerOrderLine = { id: number; isbn: string; quantity: number };
type Book = { isbn: string; quantity: number };

const API_BASE_URL = "http://localhost:3000";

export async function getAllCustomers(dbName: string): Promise<Customer[]> {
	const response = await fetch(`${API_BASE_URL}/${dbName}/customers`);
	if (!response.ok) {
		throw new Error("Failed to fetch customers");
	}
	return response.json();
}

export async function upsertCustomer(dbName: string, customer: Customer) {
	if (!customer.id) {
		throw new Error("Customer ID is required for upsert");
	}

	const url = `${API_BASE_URL}/${dbName}/customers/${customer.id}`;

	const response = await fetch(url, {
		method: "PUT",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(customer)
	});

	if (!response.ok) {
		throw new Error("Failed to upsert customer");
	}
}

export const getCustomerBooks = async (dbName: string, customerId: number): Promise<CustomerOrderLine[]> => {
	const response = await fetch(`${API_BASE_URL}/${dbName}/customer-order-lines/${customerId}`);
	if (!response.ok) {
		throw new Error("Failed to fetch customer books");
	}
	return response.json();
};

export const addBooksToCustomer = async (dbName: string, customerId: number, books: Book[]) => {
	const response = await fetch(`${API_BASE_URL}/${dbName}/customer-order-lines`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ customer_id: customerId, books })
	});

	if (!response.ok) {
		throw new Error("Failed to add books to customer");
	}
};

export const removeBooksFromCustomer = async (dbName: string, customerId: number, bookIds: number[]) => {
	const response = await fetch(`${API_BASE_URL}/${dbName}/customer-order-lines/${customerId}`, {
		method: "DELETE",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ bookIds })
	});

	if (!response.ok) {
		throw new Error("Failed to remove books from customer");
	}
};
