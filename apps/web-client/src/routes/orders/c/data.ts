// data.ts

type Customer = {
	id: number;
	fullname: string;
	email: string;
	deposit: number;
};

type CustomerOrderLine = {
	id: number;
	customer_id: number;
	isbn: string;
	quantity: number;
	created: number;
	placed?: number;
	received?: number;
	collected?: number;
};

type Book = {
	isbn: string;
	title?: string;
	authors?: string;
	publisher?: string;
	price?: number;
};

// Sample customers
const customers: Customer[] = [
	{ id: 278123, fullname: "John Doe", email: "johndoe@example.com", deposit: 100.5 },
	{ id: 263723, fullname: "Jane Smith", email: "janesmith@example.com", deposit: 200.75 }
];

// Sample order lines with calculated timestamps
const baseTimestamp = Date.now();

const customerOrderLines: CustomerOrderLine[] = [
	{
		id: 1,
		customer_id: 278123,
		isbn: "9781234567897",
		quantity: 2,
		created: baseTimestamp,
		placed: baseTimestamp + 3600 * 1000,
		received: baseTimestamp + 86400 * 1000,
		collected: 0
	},
	{
		id: 2,
		customer_id: 278123,
		isbn: "9781234567880",
		quantity: 1,
		created: baseTimestamp,
		placed: baseTimestamp + 3600 * 1000,
		received: baseTimestamp + 86400 * 1000,
		collected: 0
	},
	{
		id: 3,
		customer_id: 278123,
		isbn: "9781234567873",
		quantity: 3,
		created: baseTimestamp,
		placed: baseTimestamp + 3600 * 1000,
		received: baseTimestamp + 86400 * 1000,
		collected: 0
	},
	{
		id: 4,
		customer_id: 278123,
		isbn: "9781234567866",
		quantity: 2,
		created: baseTimestamp,
		placed: baseTimestamp + 3600 * 1000,
		received: baseTimestamp + 86400 * 1000,
		collected: 0
	},
	{
		id: 5,
		customer_id: 278123,
		isbn: "9781234567859",
		quantity: 4,
		created: baseTimestamp,
		placed: baseTimestamp + 3600 * 1000,
		received: baseTimestamp + 86400 * 1000,
		collected: 0
	},
	{
		id: 6,
		customer_id: 263723,
		isbn: "9780987654321",
		quantity: 1,
		created: baseTimestamp,
		placed: baseTimestamp + 3600 * 1000,
		received: baseTimestamp + 86400 * 1000,
		collected: 0
	},
	{
		id: 7,
		customer_id: 263723,
		isbn: "9780987654314",
		quantity: 3,
		created: baseTimestamp,
		placed: baseTimestamp + 3600 * 1000,
		received: 0,
		collected: 0
	},
	{
		id: 8,
		customer_id: 263723,
		isbn: "9780987654307",
		quantity: 2,
		created: baseTimestamp,
		placed: baseTimestamp + 3600 * 1000,
		received: 0,
		collected: 0
	},
	{
		id: 9,
		customer_id: 263723,
		isbn: "9780987654291",
		quantity: 5,
		created: baseTimestamp,
		placed: baseTimestamp + 3600 * 1000,
		received: 0,
		collected: 0
	},
	{
		id: 10,
		customer_id: 263723,
		isbn: "9780987654284",
		quantity: 1,
		created: baseTimestamp,
		placed: baseTimestamp + 3600 * 1000,
		received: 0,
		collected: 0
	}
];

const books: Record<string, Omit<Book, "isbn">> = {
	"9781234567897": { title: "The Art of Learning", authors: "Josh Waitzkin", publisher: "Free Press", price: 15.99 },
	"9781234567880": { title: "Deep Work", authors: "Cal Newport", publisher: "Grand Central Publishing", price: 18.0 },
	"9781234567873": { title: "Atomic Habits", authors: "James Clear", publisher: "Avery", price: 16.99 },
	"9781234567866": { title: "Educated", authors: "Tara Westover", publisher: "Random House", price: 14.99 },
	"9781234567859": { title: "Sapiens", authors: "Yuval Noah Harari", publisher: "Harper", price: 22.5 },
	"9780987654321": { title: "Becoming", authors: "Michelle Obama", publisher: "Crown", price: 19.5 },
	"9780987654314": { title: "Thinking, Fast and Slow", authors: "Daniel Kahneman", publisher: "Farrar, Straus and Giroux", price: 12.99 },
	"9780987654307": { title: "The Power of Habit", authors: "Charles Duhigg", publisher: "Random House", price: 13.5 },
	"9780987654291": { title: "Grit", authors: "Angela Duckworth", publisher: "Scribner", price: 15.0 },
	"9780987654284": { title: "Outliers", authors: "Malcolm Gladwell", publisher: "Little, Brown and Company", price: 14.0 }
};

// Export the data
export const data = {
	customers,
	customerOrderLines,
	books
};
