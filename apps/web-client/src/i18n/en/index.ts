import type { BaseTranslation } from "../i18n-types.js";

const nav = {
	// Inventory mgmt
	search: "Search stock",
	inventory: "Manage inventory",
	outbound: "Outbound",
	inbound: "Inbound",
	settings: "Settings",
	history: "History",

	// Orders mgmt
	supplier_orders: "Suppliers orders"
};

const search = {
	title: "Search",
	empty: {
		title: "Search for stock",
		description: "Get started by searching by title, author, ISBN"
	}
};

const historyPage = {
	date: {
		stats: {
			title: "Stats",
			totalInboundBookCount: "Inbound Book Count",
			totalInboundCoverPrice: "Inbound Cover Price",
			totalInboundDiscountedPrice: "Inbound Discounted Price",
			totalOutboundBookCount: "Outbound Book Count",
			totalOutboundCoverPrice: "Outbound Cover Price",
			totalOutboundDiscountedPrice: "Outbound Discounted Price"
		},
		transactions: {
			title: "Transactions",
			committed: "Committed"
		}
	},
	isbn: {
		transactions: "Transactions",
		history: "History",
		isbnId: {
			stock: "Stock",
			placeholderBox: {
				title: "No transactions found",
				description: "There seems to be no record of transactions for the given isbn volumes going in or out"
			}
		},
		placeholderBox: {
			title: "No book selected",
			description: "Use the search field to find the book you're looking for"
		}
	},
	notes: {
		datePage: {
			history: "History",
			books: "Books",
			totalCoverPrice: "Total cover price",
			committed: "Committed",
			totalDiscountedPrice: "Total discounted price"
		},
		archivePage: {
			committedAt: "Committed At",
			exportCSV: "Export CSV"
		}
	},
	warehouse: {
		warehouseId: {
			from: {
				options: {
					all: {
						label: "All"
					},
					inbound: {
						label: "Inbound"
					},
					outbound: {
						label: "Outbound"
					}
				},
				columnHeaders: {
					quantity: "quantity",
					isbn: "isbn",
					title: "title",
					publisher: "publisher",
					authors: "authors",
					year: "year",
					price: "price",
					category: "category",
					editedBy: "edited_by",
					outOfPrint: "out_of_print"
				},
				heading: {
					history: "history",
					exportCSV: "Export CSV",
					from: "From",
					to: "To",
					filter: "Filter"
				}
			}
		},
		books: "books",
		discount: "discount"
	}
};

const inventoryPage = {
	inbound: {
		PlaceholderBox: {
			title: "No open notes",
			description: "Get started by adding a new note with the appropriate warehouse"
		},
		BackToWarehouses: "Back to warehouses",
		books: "books",
		lastUpdated: "Last Updated",
		edit: "Edit",
		inboundId: {
			lastUpdated: "Last updated",
			commit: "Commit",
			print: "Print",
			autoPrintBookLabels: "Auto print book labels",
			delete: "Delete",
			editRow: "Edit row",
			printBookLabel: "Print book label",
			deleteRow: "Delete row"
		}
	},
	outbound: {
		PlaceholderBox: {}
	}
};

const en = {
	nav,
	search,
	historyPage,
	inventoryPage
} satisfies BaseTranslation;

export default en;
