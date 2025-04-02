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

const history_page = {
	date_tab: {
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
	isbn_tab: {
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
	notes_tab: {
		date: {
			history: "History",
			books: "Books",
			totalCoverPrice: "Total cover price",
			committed: "Committed",
			totalDiscountedPrice: "Total discounted price"
		},
		archive: {
			committedAt: "Committed At",
			exportCSV: "Export CSV"
		}
	},
	warehouse_tab: {
		warehouseId: {
			from: {
				filter_options: {
					all: "All",
					inbound: "Inbound",
					outbound: "Outbound"
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
				},
				transactions: "Transactions"
			}
		},
		books: "books",
		discount: "discount"
	}
};

const inventory_page = {
	inbound_tab: {
		PlaceholderBox: {
			title: "No open notes",
			description: "Get started by adding a new note with the appropriate warehouse"
		},
		back_to_warehouses: "Back to warehouses",
		books: "books",
		last_updated: "Last Updated",
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
	}
};
const orders_page = {
	checkout: "Checkout",
	create_outbound_note: "Create a new Outbound Note"
};

const customer_orders_page = {
	title: "Customer Orders",
	new_order: "New Order",
	status_filters: {
		in_progress: "In Progress",
		completed: "Completed"
	},
	customer: "Customer",
	order_id: "Order ID",
	update_order: "Update Order",
	customer_details: "Customer Details",
	update: "Update"
};

const suppliers_page = {
	new_supplier: "New Supplier",
	suppliers: "Suppliers",
	delete: "Delete",
	edit: "Edit",
	supplier: {
		supplier_page: "Supplier page",
		supplier_name: "Supplier name",
		supplier_address: "Supplier address",
		supplier_email: "Supplier email",
		create_new_order: "Create new order",
		assigned_publishers: "Assigned publishers",
		publisher_name: "Publisher name",
		remove_publisher: "Remove publisher",
		unassigned_publishers: "Unassigned publishers",
		add_to_supplier: "Add to supplier"
	},
	new_order_page: {
		total_books: "Total books",
		total_value: "Total value",
		books: "Books",
		select: "Select",
		isbn: "ISBN",
		title: "Title",
		authors: "Authors",
		ordered_quantity: "Ordered quantity",
		total: "Total",
		selected_quantity: "Selected quantity",
		selected_books: "Selected books",
		place_order: "Place Order"
	}
};

const en = {
	nav,
	search,
	history_page,
	inventory_page,
	orders_page,
	customer_orders_page,
	suppliers_page
} satisfies BaseTranslation;

export default en;
