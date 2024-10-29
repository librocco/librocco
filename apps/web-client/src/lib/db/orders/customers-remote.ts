type Customer = {
	id?: number;
	fullname?: string;
	email?: string;
	deposit?: number;
};

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

