import type { BaseTranslation } from "../i18n-types.js";

const nav = {
	// Inventory mgmt
	search: "Search stock",
	books: "View known books",
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
			export_csv: "Export CSV",
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
			}
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
			books: "{ no_of_books } book{{s}}",
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
			books: "{ no_of_books } book{{s}}",
			last_updated: "Updated"
		},
		labels: {
			button_edit: "Edit"
		}
	}
};
const orders_page = {
	labels: {
		checkout: "Checkout",
		create_outbound_note: "Create a new Outbound Note"
	}
};

const supplier_orders_page = {
	title: {
		supplier_orders: "Supplier Orders"
	},
	labels: {
		suppliers: "Suppliers"
	},
	tabs: {
		unordered: "Unordered",
		ordered: "Ordered",
		reconciling: "Reconciling",
		completed: "Completed"
	},
	placeholder: {
		description: "No unordered supplier orders available. Create a customer order first to generate supplier orders.",
		button: "New Customer Order"
	}
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

	labels: {
		new_order: "New Order",
		update_order: "Update Order",
		update: "Update"
	},
	tabs: {
		in_progress: "In Progress",
		completed: "Completed"
	},
	table: {
		customer: "Customer",
		order_id: "Order ID",
		customer_details: "Customer Details"
	}
};
const new_order_page = {
	stats: {
		total_books: "Total books",
		total_value: "Total value",
		selected_books: "Selected books"
	},
	table: {
		ordered_quantity: "Ordered quantity",
		total: "Total",
		selected_quantity: "Selected quantity",
		books: "Books",
		isbn: "ISBN",
		title: "Title",
		authors: "Authors"
	},
	labels: {
		select: "Select",
		place_order: "Place Order"
	}
};

const order_list_page = {
	labels: {
		remove_publisher: "Remove publisher",
		create_new_order: "Create new order",
		add_to_supplier: "Add to supplier"
	},
	details: {
		supplier_page: "Supplier page",
		supplier_name: "Supplier name",
		supplier_address: "Supplier address",
		supplier_email: "Supplier email"
	},
	table: {
		publisher_name: "Publisher name",
		assigned_publishers: "Assigned publishers",
		unassigned_publishers: "Unassigned publishers"
	}
};
const reconciled_list_page = {
	labels: {
		view_reconciliation: "View Reconciliation",
		reconcile: "Reconcile",
		print_order: "Print Order"
	},
	stats: {
		total_books: "Total books",
		ordered: "Ordered",
		total_value: "Total value"
	},
	table: {
		books: "Books",
		isbn: "ISBN",
		title: "Title",
		authors: "Authors",
		quantity: "Quantity",
		total_price: "Total Price"
	}
};

const reconcile_page = {
	title: {
		reconcile_deliveries: "Reconcile Deliveries"
	},
	stats: {
		created: "Created",
		last_updated: "Last Updated",
		includes_supplier_orders: "Includes supplier orders",
		total_delivered: "Total delivered"
	},
	placeholder: {
		description: "Scan or enter the ISBNs of the delivered books to begin reconciliation."
	},
	table: {
		isbn: "ISBN",
		title: "Title",
		authors: "Authors",
		quantity: "Quantity",
		price: "Price"
	},
	delete_dialog: {
		title: "Delete Reconciliation Order",
		description: "Are you sure you want to delete this reconciliation order? This action will delete all the scanned lines."
	}
};
const suppliers_page = {
	labels: {
		new_supplier: "New Supplier"
	},
	title: {
		suppliers: "Suppliers"
	},
	table: {
		delete: "Delete",
		edit: "Edit"
	}
};

const warehouse_list_page = {
	stats: {
		books: "books",
		discount: "discount"
	},
	labels: {
		new_note: "New note",
		view_stock: "View Stock"
	}
};

const warehouse_page = {
	table: {
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
};

const common = {
	delete_dialog: {
		title: `Permenantly delete {entity}?`,
		description: "Once you delete this note, you will not be able to access it again"
	},
	commit_inbound_dialog: {
		title: `Commit inbound {entity}?`,
		description: `{ bookCount } book{{s}} will be added to { warehouseName }`
	},
	commit_outbound_dialog: {
		title: `Commit outbound {entity}?`,
		description: `{ bookCount } book{{s}} will be removed from your stock`
	},
	no_warehouse_dialog: {
		title: "No warehouse(s) selected",
		description: "Can't commit the note as some transactions don't have any warehouse selected"
	},
	reconcile_outbound_dialog: {
		title: "Stock mismatch",
		description: "Some quantities requested are greater than available in stock and will need to be reconciled in order to proceed."
	},
	edit_book_dialog: {
		title: "Edit book details",
		description: "Update book details"
	},
	create_custom_item_dialog: {
		title: "Create custom item"
	},
	edit_custom_item_dialog: {
		title: "Edit custom item"
	},
	edit_warehouse_dialog: {
		title: "Update warehouse details",
		description: "Update warehouse details"
	},
	delete_warehouse_dialog: {
		description: `Once you delete this warehouse { bookCount } book{{s}} will be removed from your stock`
	},
	delete_database_dialog: {
		description: `Once you delete this database it can't be restored. In order to save the backup first, please use the export button.`
	},
	create_database_dialog: {
		title: "Create new database",
		description: "Please type in the name for the new database"
	}
};
const outbound_note = {
	delete_dialog: {
		select_warehouse: "Please select a warehouse for each of the following transactions"
	},
	reconcile_dialog: {
		review_transaction: "Please review the following transactions",
		quantity: "quantity for reconciliation"
	},
	labels: {
		new_note: "New Note",
		edit: "Edit",
		print_book_label: "Print book label",
		delete_row: "Delete row",
		edit_row: "Edit row",
		delete: "Delete"
	},
	stats: {
		last_updated: "Last updated",
		books: "{ bookCount } book{{s}}"
	},
	placeholder: {
		select_warehouse: "Please select a warehouse",
		no_warehouses: "No available warehouses"
	}
};

const outbound_page = {
	heading: "Outbound",
	stats: {
		last_updated: "Last updated",
		books: "{ bookCount } book{{s}}"
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
const supplier_orders_component = {
	commit_dialog: {
		heading: "Finalize reconciliation order",
		delivered_book_count: "{ deliveredBookCount } books will be marked as delivered (and ready to be collected)",
		rejected_book_count: "{ rejectedBookCount } books will be marked as rejected (waiting for reordering)",
		cancel: "Cancel",
		confirm: "Confirm"
	},
	comparison_table: {
		isbn: "ISBN",
		title: "Title",
		authors: "Authors",
		price: "Price",
		ordered_quantity: "Ordered Quantity",
		delivered_quantity: "Delivered Quantity",
		unmatched_books: "Unmatched Books"
	},
	completed_table: {
		supplier: "Supplier",
		books: "Books",
		placed: "Placed",
		actions: "Actions",
		view_order: "View Order",
		view_reconciliation: "View Reconciliation"
	},
	ordered_table: {
		supplier: "Supplier",
		books: "Books",
		placed: "Placed",
		actions: "Actions",
		selected_orders_summary: "Selected orders summary",
		selected_orders: "{ selectedOrders } orders selected",
		reconcile_selected: "Reconcile Selected",
		view_order: "View Order",
		reconcile: "Reconcile",
		view_reconciliation: "View Reconciliation"
	},
	reconciling_table: {
		order_id: "Order Id",
		supplier_orders: "Supplier Orders",
		last_updated: "Last Updated",
		update_order: "Update order",
		continue: "Continue"
	},
	unordered_table: {
		supplier: "Supplier",
		books: "Books",
		place_order: "Place Order"
	}
};

const table_components = {
	inventory_tables: {
		book_price_cell: {
			discounted_price: "Discounted Price",
			original_price: "Original Price",
			percentage_discount: "Percentage Discount"
		},
		inbound_table: {
			isbn: "ISBN",
			book: "Book",
			title: "Title",
			authors: "Authors",
			price: "Price",
			quantity: "Quantity",
			publisher: "Publisher",
			year: "Year",
			edited_by: "Edited By",
			op: "O.P",
			category: "Category",
			delivered_quantity: "Delivered Quantity",
			unmatched_books: "Unmatched Books"
		},
		stock_table: {
			isbn: "ISBN",
			book: "Book",
			title: "Title",
			authors: "Authors",
			price: "Price",
			quantity: "Quantity",
			publisher: "Publisher",
			year: "Year",
			edited_by: "Edited By",
			op: "O.P",
			category: "Category",
			delivered_quantity: "Delivered Quantity",
			unmatched_books: "Unmatched Books"
		},
		outbound_table: {
			isbn: "ISBN",
			book: "Book",
			title: "Title",
			authors: "Authors",
			price: "Price",
			quantity: "Quantity",
			publisher: "Publisher",
			year: "Year",
			warehouse: "Warehouse",
			category: "Category",
			row_actions: "Row Actions"
		}
	},
	order_tables: {
		order_line_table: {
			isbn: "ISBN",
			book: "Book",
			title: "Title",
			status: "Status",
			authors: "Authors",
			price: "Price",

			publisher: "Publisher",
			year: "Year",
			discounted_price: "Discounted Price",
			original_price: "Original Price",
			percentage_discount: "Percentage Discount"
		},
		supplier_order_table: {
			supplier: "Supplier",
			total_books: "Total Books",
			ordered: "Ordered",
			order_no: "Order no.",
			edit: "Edit",
			manage: "Manage"
		},
		supplier_table: {
			labels: {
				name: "Name",
				email: "Email",
				address: "Address",

				assigned_publishers: "Assigned Publishers",
				row_actions: "Row Actions"
			}
		}
	}
};

const misc_components = {
	extension_banner: {
		book_data_extension: "Book Data Extension",
		remote_db: "Remote DB"
	},
	page_layout: {
		stock: "Stock",
		checkout: "Checkout"
	},
	warehouse_select: {
		label: "Select a warehouse to withdraw book { rowIx } from",
		default_option: "Select a warehouse"
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
	warehouse_list_page,
	warehouse_page,
	outbound_note,
	outbound_page,
	inbound_note,
	settings_page,
	stock_page,
	common,
	supplier_orders_page,
	new_order_page,
	reconcile_page,
	reconciled_list_page,
	order_list_page,
	supplier_orders_component,
	table_components,
	misc_components
} satisfies BaseTranslation;

export default en;
