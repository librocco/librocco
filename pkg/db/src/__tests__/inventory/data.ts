/**
 * Not to be confused with fixtures, loaded from the container holding test data and used for stress tests/benchmarks,
 * this module contains test data used to test the core functionality of db interface
 */

/** A collection of 50 entries with fake isbns and fake titles, all with quantity 5, used to test note pagination. */
export const fiftyEntries = Array(50)
	.fill(null)
	.map((_, i) => {
		const iStr = i.toString();
		const isbn = ["0".repeat(10 - iStr.length), iStr].join("");
		return { isbn, quantity: 5 };
	});
