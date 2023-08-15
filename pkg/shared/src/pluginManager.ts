interface BookEntry {
	isbn: string;
	title: string;
	price: number;
	year?: string;
	authors?: string;
	publisher?: string;
	editedBy?: string;
	outOfPrint?: boolean;
}

export class PluginManager {
	#enabled: boolean;

	constructor() {
		this.#enabled = true;
	}
	getBook(isbn: string): Promise<BookEntry | null> {
		// This is a mock function that returns a Promise resolving to a dummy book object after 300 ms
		// would be replaced with a call to real plugin manager

		return new Promise((resolve) => {
			setTimeout(() => {
				if (!this.#enabled) {
					resolve(null);
				}
				resolve({
					title: `Book with ISBN ${isbn}`,
					authors: "Some Author",
					isbn,
					price: 10
				});
			}, 300);
		});
	}
	enable(): void {
		this.#enabled = true;
	}
	disable(): void {
		this.#enabled = false;
	}
}
