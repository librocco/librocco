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
			total_inbound_book_count: "Inbound Book Count",
			total_inbound_cover_price: "Inbound Cover Price",
			total_inbound_discounted_price: "Inbound Discounted Price",
			total_outbound_book_count: "Outbound Book Count",
			total_outbound_cover_price: "Outbound Cover Price",
			total_outbound_discounted_price: "Outbound Discounted Price"
		},
		transactions: {
			title: "Transactions",
			committed: "Committed"
		}
	},
	isbn_tab: {
		titles: {
			transactions: "Transactions",
			history: "History"
		},
		isbn_id: {
			titles: {
				stock: "Stock"
			},
			placeholder_box: {
				title: "No transactions found",
				description: "There seems to be no record of transactions for the given isbn volumes going in or out"
			}
		},
		placeholder_box: {
			title: "No book selected",
			description: "Use the search field to find the book you're looking for"
		}
	},
	notes_tab: {
		date: {
			history: "History",
			books: "Books",
			total_cover_price: "Total cover price",
			committed: "Committed",
			total_discounted_price: "Total discounted price"
		},
		archive: {
			committed_at: "Committed At",
			export_csv: "Export CSV"
		}
	},
	warehouse_tab: {
		note_table: {
			filter_options: {
				all: "All",
				inbound: "Inbound",
				outbound: "Outbound"
			},
			column_headers: {
				quantity: "quantity",
				isbn: "isbn",
				title: "title",
				publisher: "publisher",
				authors: "authors",
				year: "year",
				price: "price",
				category: "category",
				edited_by: "edited_by",
				out_of_print: "out_of_print"
			},
			heading: {
				history: "history",
				export_csv: "Export CSV",
				from: "From",
				to: "To",
				filter: "Filter"
			},
			titles: {
				transactions: "Transactions"
			}
		},
		stats: {
			books: "{no_of_books} book{{s}}",
			discount: "discount"
		}
	}
};

const inventory_page = {
	inbound_tab: {
		placeholder_box: {
			title: "No open notes",
			description: "Get started by adding a new note with the appropriate warehouse"
		},
		stats: {
			back_to_warehouses: "Back to warehouses",
			books: "{no_of_books} book{{s}}",
			last_updated: "Last Updated"
		},
		labels: {
			button_edit: "Edit"
		}
	}
};
const orders_page = {
	checkout: "Checkout",
	create_outbound_note: "Create a new Outbound Note"
};
const inbound_note = {
	stats: {
		last_updated: "Last updated"
	},
	labels: {
		commit: "Commit",
		print: "Print",
		auto_print_book_labels: "Auto print book labels",
		delete: "Delete",
		edit_row: "Edit row",
		print_book_label: "Print book label",
		delete_row: "Delete row"
	}
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
	supplierId: {
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
		},
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
	orders_page: {
		supplier_orders: "Supplier Orders",
		suppliers: "Suppliers",
		unordered: "Unordered",
		ordered: "Ordered",
		reconciling: "Reconciling",
		completed: "Completed",
		no_unordered_books: {
			description: "No unordered supplier orders available. Create a customer order first to generate supplier orders.",
			button: "New Customer Order"
		},
		orderId: {
			reconciled_list: {
				view_reconciliation: "View Reconciliation",
				reconcile: "Reconcile",
				total_books: "Total books",
				total_value: "Total value",
				ordered: "Ordered",
				print_order: "Print Order",
				books: "Books",
				isbn: "ISBN",
				title: "Title",
				authors: "Authors",
				quantity: "Quantity",
				total_price: "Total Price"
			}
		}
	},
	reconcile_page: {
		reconcile_deliveries: "Reconcile Deliveries",
		created: "Created",
		last_updated: "Last Updated",
		includes_supplier_orders: "Includes supplier orders",
		no_books: "Scan or enter the ISBNs of the delivered books to begin reconciliation.",
		isbn: "ISBN",
		title: "Title",
		authors: "Authors",
		quantity: "Quantity",
		price: "Price",
		total_delivered: "Total delivered",
		delete_dialog: {
			confirmDeleteDialogHeading: "Delete Reconciliation Order",
			confirmDeleteDialogDescription:
				"Are you sure you want to delete this reconciliation order? This action will delete all the scanned lines."
		}
	}
};

const warehouses = {
	warehouse_id: {
		display_label: {
			quantity: "Quantity",
			isbn: "ISBN",
			title: "Title",
			publisher: "Publisher",
			authors: "Authors",
			year: "Year",
			price: "Price",
			category: "Category",
			edited_by: "Edited by",
			out_of_print: "Out of print"
		},
		labels: {
			export_to_csv: "Export to CSV",
			new_note: "New note",
			edit_row: "Edit row",
			print_book_label: "Print book label",
			edit_book_details: "Edit book details",
			manually_edit_book_details: "Manually edit book details"
		}
	},

	stats: {
		books: "books",
		discount: "discount"
	},
	labels: {
		new_note: "New note",
		view_stock: "View Stock"
	}
};
const dialog_title = {
	// Misc
	delete: `Permenantly delete {entity}?`,

	// Inbond
	commit_inbound: `Commit inbound {entity}?`,

	// Outbound
	commit_outbound: `Commit outbound {entity}?`,
	no_warehouse_selected: "No warehouse(s) selected",
	reconcile_outbound: "Stock mismatch",

	// BookForm
	edit_book: "Edit book details",
	create_custom_item: "Create custom item",
	edit_custom_item: "Edit custom item",

	// WarehouseForm
	edit_warehouse: "Update book details",

	// DatabaseForm
	create_database: "Create new database"
};

const dialog_description = {
	// Misc
	delete_note: "Once you delete this note, you will not be able to access it again",
	delete_warehouse: `Once you delete this warehouse {bookCount} book{{s}} will be removed from your stock`,
	delete_database: `Once you delete this database it can't be restored. In order to save the backup first, please use the export button.`,

	// Inbound
	commit_inbound: `{bookCount} book{{s}} will be added to {warehouseName}`,

	// Outbound
	commit_outbound: `{bookCount} book{{s}} will be removed from your stock`,
	no_warehouse_selected: "Can't commit the note as some transactions don't have any warehouse selected",
	reconcile_outbound: "Some quantities requested are greater than available in stock and will need to be reconciled in order to proceed.",

	// BookForm
	edit_book: "Update book details",

	// WarehouseForm
	edit_warehouse: "Update warehouse details",

	// DatabaseForm
	create_database: "Please type in the name for the new database"
};

const outbound_note = {
	delete_dialog: {
		select_warehouse: "Please select a warehouse for each of the following transactions"
	},
	reconcile_dialog: {
		review_transaction: "Please review the following transactions",
		quantity: "quantity for reconciliation"
	},
	stats: {
		last_updated: "Last updated"
	},
	labels: {
		delete: "Delete",
		edit_row: "Edit row",
		print_book_label: "Print book label",
		delete_row: "Delete row"
	}
};

const outbound_page = {
	heading: "Outbound",
	stats: {
		last_updated: "Last updated",
		books: "{bookCount} book{{s}}"
	},
	labels: {
		new_note: "New Note",
		edit: "Edit",
		print_book_label: "Print book label",
		delete_row: "Delete row"
	}
};
const stock_page = {
	labels: {
		edit_book_details: "Edit book details",
		manually_edit_book_details: "Manually edit book details",
		edit_row: "Edit row",
		print_book_label: "Print book label"
	}
};

const settings_page = {
	headings: {
		settings: "Settings",
		device_settings: "Device settings",
		sync_settings: "Sync settings",
		db_management: "Database management"
	},
	descriptions: {
		sync_settings: "Manage DB name, sync URL and the connection. Note: This will be merged with DB selection in the future",
		db_management: "Use this section to create, select, import, export or delete a database",
		import: "Drag and drop your .sqlite3 file here to import",
		device_settings: "Manage connections to external devices"
	},

	stats: {
		version: "Version"
	},
	labels: {
		new: "New"
	}
};

const en = {
	nav,
	search,
	history_page,
	inventory_page,
	orders_page,
	customer_orders_page,
	suppliers_page,
	warehouses,
	dialog_title,
	dialog_description,
	outbound_note,
	outbound_page,
	inbound_note,
	settings_page,
	stock_page
} satisfies BaseTranslation;

export default en;
