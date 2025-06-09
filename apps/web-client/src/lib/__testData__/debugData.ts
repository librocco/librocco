// Books
const books = [
	{
		isbn: "9781234567897",
		title: "The Art of Learning",
		authors: "Josh Waitzkin",
		publisher: "Scholastic",
		price: 15.99
	},
	{
		isbn: "9788804797142",
		title: "Lord of the Flies",
		authors: "William Golding",
		publisher: "Mondadori",
		price: 18.0
	},
	{
		isbn: "9780385504201",
		title: "The Da Vinci Code",
		authors: "Dan Brown",
		publisher: "Doubleday",
		price: 19.95
	},
	{
		isbn: "9780553296983",
		title: "Dune",
		authors: "Frank Herbert",
		publisher: "Ace",
		price: 24.5
	}
];

// Suppliers
const suppliers = [
	{
		id: 1,
		name: "BooksRUs",
		email: "contact@booksrus.com",
		address: "123 Book St, New York, NY",
		customerId: 1111
	},
	{
		id: 2,
		name: "NovelSupply Co.",
		email: "support@novelsupply.co",
		address: "456 Fiction Ave, Los Angeles, CA",
		customerId: 2222
	}
];

// Supplier Publisher Relationships
const supplierPublishers = [
	{ supplierId: 1, publisher: "Mondadori" },
	{ supplierId: 1, publisher: "Doubleday" },
	{ supplierId: 2, publisher: "Scholastic" },
	{ supplierId: 2, publisher: "Ace" }
];

// Customers
const customers = [
	{
		id: 1,
		displayId: "1",
		fullname: "Alice Smith",
		email: "alice.smith@example.com",
		deposit: 50.0
	},
	{
		id: 2,
		displayId: "2",
		fullname: "Bob Johnson",
		email: "bob.johnson@example.com",
		deposit: 30.0
	}
];

// Customer Order Lines
const customerOrderLines = [
	{ id: 1, customer_id: 1, isbn: "9781234567897", placed: 1, received: 0, collected: 0 },
	{ id: 2, customer_id: 1, isbn: "9788804797142", placed: 1, received: 1, collected: 0 },
	{ id: 3, customer_id: 1, isbn: "9780385504201", placed: 0, received: 0, collected: 0 },
	{ id: 4, customer_id: 2, isbn: "9780385504201", placed: 1, received: 1, collected: 1 },
	{ id: 5, customer_id: 2, isbn: "9780553296983", placed: 1, received: 0, collected: 0 },
	{ id: 6, customer_id: 2, isbn: "9781234567897", placed: 0, received: 0, collected: 0 }
];

// Supplier Orders
const supplierOrders = [
	{ id: 1, supplierId: 1, created: 1700000000000 },
	{ id: 2, supplierId: 2, created: 1700005000000 }
];

// Supplier Order Lines
const supplierOrderLines = [
	{ supplier_order_id: 1, isbn: "9780590353427", quantity: 5, supplier_id: 1 },
	{ supplier_order_id: 2, isbn: "9780439064873", quantity: 3, supplier_id: 2 }
];

// Reconciliation Orders
const reconciliationOrders = [
	{ id: 1, supplier_order_ids: [1], finalized: 0 },
	{ id: 2, supplier_order_ids: [2], finalized: 1 }
];

// Reconciliation Order Lines
const reconciliationOrderLines = [
	{ reconciliation_order_id: 1, isbn: "9781234567897", quantity: 1 },
	{ reconciliation_order_id: 2, isbn: "9788804797142", quantity: 1 }
];

// Complete data object
export const debugData = {
	books,
	suppliers,
	supplierPublishers,
	customers,
	customerOrderLines,
	supplierOrders,
	supplierOrderLines,
	reconciliationOrders,
	reconciliationOrderLines
};
