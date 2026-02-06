import type { BaseTranslation } from "../i18n-types.js";

const nav = {
	// Inventory mgmt
	search: "Search stock",
	books: "View known books",
	inventory: "Manage inventory",
	sale: "Sale",
	purchase: "Purchase",
	settings: "Settings",
	history: "History",

	// Orders mgmt
	supplier_orders: "Suppliers orders",
	customers: "Customers"
};

const page_headings = {
	outbound: "Sales",
	inbound: "Purchases",
	warehouse: "Warehouses"
};

const search = {
	title: "Search",
	empty: {
		title: "Search for stock",
		description: "Get started by searching by title, author, ISBN"
	},
	placeholder: "Search stock by ISBN"
};

const history_page = {
	title: "History",
	tabs: {
		by_date: "By Date",
		by_isbn: "By ISBN",
		notes_by_date: "Notes by date",
		by_warehouse: "by Warehouse"
	},
	date_tab: {
		stats: {
			title: "Stats",
			total_purchase_book_count: "Purchase Book Count",
			total_purchase_cover_price: "Purchase Cover Price",
			total_purchase_discounted_price: "Purchase Discounted Price",
			total_sale_book_count: "Sale Book Count",
			total_sale_cover_price: "Sale Cover Price",
			total_sale_discounted_price: "Sale Discounted Price"
		},
		transactions: {
			title: "Transactions",
			committed: "Committed"
		},
		placeholder_box: {
			title: "No Books on that date",
			description: "Try selecting a different date."
		}
	},
	isbn_tab: {
		titles: {
			transactions: "Transactions",
			history: "History"
		},
		search: {
			placeholder: "Search"
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
		},
		placeholder: {
			title: "No notes found",
			description: "No notes seem to have been committed on that date"
		}
	},
	warehouse_tab: {
		note_table: {
			filter_options: {
				all: "All",
				purchase: "Purchase",
				sale: "Sale"
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
			},
			placeholder: {
				title: "No transactions found",
				description: "There seem to be no transactions going in/out for the selected date range"
			}
		},
		stats: {
			books: "{ no_of_books } book{{s}}",
			discount: "discount"
		}
	}
};

const inventory_page = {
	purchase_tab: {
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
			button_edit: "Edit",
			button_delete: "Delete"
		}
	},
	warehouses_tab: {
		title: "Warehouses",
		labels: {
			button_create_purchase: "New purchase",
			create_warehouse: "Create warehouse"
		},
		placeholder: {
			title: "No warehouses",
			description: "Get started by creating a warehouse"
		}
	}
};
const orders_page = {
	labels: {
		checkout: "Checkout",
		create_sale_note: "Create a new Sale Note"
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
		title: "There are no pending supplier orders",
		description: "Create customer orders to generate supplier orders",
		button: "New Customer Order"
	}
};
const purchase_note = {
	commit_dialog: {
		title: `Commit purchase "{entity}"?`,
		description: `{ bookCount } book{{s}} will be added to { warehouseName }`
	},
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
		delete_row: "Delete row",
		edit: "Edit"
	},
	placeholder: {
		scan_title: "Scan to add books",
		scan_description: "Plugin your barcode scanner and pull the trigger"
	}
};

const customer_orders_page = {
	title: "Customer Orders",

	labels: {
		new_order: "New Order",
		edit: "Edit",
		save: "Save",
		create: "Create",
		edit_customer: "Edit customer",
		print_receipt: "Print receipt",
		edit_line: "Edit line",
		collect: "Collect",
		delete_row: "Delete row",
		edit_row: "Edit row"
	},
	table_columns: {
		order_id: "ID",
		name: "Name",
		email: "Email",
		updated: "Updated",
		actions: "Actions",
		isbn: "ISBN",
		title: "Title",
		authors: "Authors",
		price: "Price",
		publisher: "Publisher",
		status: "Status"
	},
	placeholder: {
		search: "Search for customers by name",
		no_orders: {
			title: "There are no customers",
			description: "Create a new customer order to get started"
		},
		scan_title: "Scan to add books",
		scan_description: "Plugin your barcode scanner and pull the trigger"
	},
	new_customer_dialog: {
		title: "new customer form dialog",
		description: "enter new customer details"
	},
	customer_details: {
		last_updated: "Last updated",
		customer_id: "Customer ID",
		customer_email: "Customer email",
		customer_phone: "Customer phone",
		secondary_phone: "Secondary phone",
		deposit: "Deposit",
		deposit_amount: "€{amount} deposit",
		books_heading: "Books",
		total: "Total:"
	},
	status: {
		collected: "Collected",
		delivered: "Delivered",
		placed: "Placed",
		pending: "Pending"
	},
	status_badges: {
		with_date: "{status} - {date:Date|dateShort}"
	},
	dialogs: {
		new_customer: {
			title: "Create new order"
		},
		edit_customer: {
			title: "Edit customer details"
		}
	}
};

const new_order_page = {
	title: "New Supplier Order",
	aria: {
		last_updated: "Last updated"
	},
	stats: {
		total_books: "Total books",
		total_value: "Total value",
		selected_books: "Selected books",
		order_format: "Order Format",
		no_order_format: "Order format needs to be configured",
		go_to_supplier: "Go to supplier"
	},
	table: {
		quantity: "Quantity",
		total: "Total",
		books: "Books",
		isbn: "ISBN",
		title: "Title",
		authors: "Authors"
	},
	labels: {
		select: "Select",
		place_order: "Place Order",
		no_format_tooltip: "No format configured"
	}
};

const order_list_page = {
	labels: {
		remove_publisher: "Remove publisher",
		create_new_order: "Create new order",
		add_to_supplier: "Add to supplier",
		reassign_publisher: "Re-assign to supplier"
	},
	details: {
		supplier_page: "Supplier page",
		supplier_name: "Supplier name",
		supplier_email: "Supplier email",
		supplier_address: "Supplier address",
		supplier_customerId: "Supplier customer ID",
		supplier_orderFormat: "Supplier order format"
	},
	table: {
		publisher_name: "Publisher name",
		assigned_publishers: "Assigned publishers",
		unassigned_publishers: "Unassigned publishers",
		other_supplier_publishers: "Other Supplier Publishers"
	},
	dialogs: {
		reassign_publisher: {
			title: "Re-assign publisher",
			description: "Are you sure you want to remove {publisher} from its previous supplier and assign it to {supplier}?"
		}
	}
};

// The "placed order" page seems to have been setup
// to use the same strings as the following "reconcilied_list_page"
// so as not to disturbe to many things, I've kept it that way, and have added additional strings here
const order_page = {
	title: "Supplier Order"
};

const reconciled_list_page = {
	labels: {
		view_reconciliation: "View Reconciliation",
		reconcile: "Reconcile",
		print_order: "Print Order",
		download_order: "Download Order"
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
		total_delivered: "Total delivered",
		finalized_at: "Finalized At"
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
	},
	steps: {
		populate: {
			title: "Populate",
			description: "Delivered books"
		},
		compare: {
			title: "Compare",
			description: "To ordered"
		},
		commit: {
			title: "Commit",
			description: "Notify customers"
		}
	}
};
const suppliers_page = {
	title: "Suppliers",
	placeholder: {
		title: "There are no suppliers",
		description: "Create a new supplier to manage publisher catalogues"
	},
	dialog: {
		new_order_title: "Create new supplier"
	},
	labels: {
		save: "Create",
		new_supplier: "New Supplier",
		edit: "Edit"
	},
	columns: {
		name: "Name",
		email: "Email",
		address: "Address",
		assigned_publishers: "Assigned Publishers",
		actions: "Actions",
		order_format: "Order Format"
	}
};

const warehouse_list_page = {
	title: "Warehouses",
	stats: {
		books: "books",
		discount: "discount"
	},
	labels: {
		new_note: "New note",
		view_stock: "View Stock",
		edit: "Edit",
		delete: "Delete"
	},
	placeholder: {
		title: "No warehouses",
		description: "Get started by creating a warehouse"
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
	},
	placeholder: {
		title: "Add new purchase note",
		description: "Get started by adding a new note"
	}
};

const books_page = {
	title: "Known books",
	placeholder: {
		empty_database: {
			title: "No results",
			description: "Book database is empty. Start by adding some books to stock."
		},
		no_results: {
			title: "No results",
			description: "Search found no results"
		}
	},
	labels: {
		popover_control: "Row actions",
		edit_row: "Edit row",
		print_book_label: "Print book label",
		edit_book_details: "Edit book details",
		manually_edit_book_details: "Manually edit book details"
	}
};

const debug_page = {
	title: "Debug",
	labels: {
		runtime_error: "Kaboom! Runtime error"
	},
	actions: {
		trigger_load_error: "Trigger Load Error",
		trigger_runtime_error: "Trigger Runtime Error",
		populate_database: "Populate Database",
		reset_database: "Reset Database",
		upsert_100_books: "Upsert 100 Books",
		run_query: "Run Query",
		executing: "Executing...",
		corrupt_sync_state: "Corrupt Sync State"
	},
	query_interface: {
		title: "Database Query Interface",
		results_title: "Query Results:",
		no_results: "No results found."
	},
	table: {
		title: "Table",
		number_of_objects: "Number of objects"
	}
};

const common = {
	delete_dialog: {
		title: `Permenantly delete {entity}?`,
		description: "Once you delete this note, you will not be able to access it again"
	},
	edit_book_dialog: {
		title: "Edit book details",
		description: "Update book details"
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
	},
	action_dropdown_trigger_aria: "open actions dropdown",
	actions: {
		cancel: "Cancel",
		confirm: "Confirm",
		import: "Import",
		select: "Select",
		reload: "Reload",
		print: "Print table"
	},
	placeholders: {
		no_results: "No results",
		search_found_no_results: "Search found no results",
		unknown_title: "Unknown Title"
	},
	loading: "Loading"
};
const sale_note = {
	commit_dialog: {
		title: `Commit sale "{entity}"?`,
		description: `{ bookCount } book{{s}} will be removed from your stock`,
		stock_adjustement_detail: {
			summary: "Some quantities requested are greater than available in stock. Please review the following stock adjustments:",
			detail_list: {
				row: "{isbn} from {warehouse}",
				requested: "Requested: {quantity:number} {{copy|copies}}",
				available: "Available: {quantity:number} {{copy|copies}}",
				adjustment: "Adjustment: {quantity:number} {{copy|copies}}"
			}
		}
	},
	force_withdrawal_dialog: {
		title: "Force withdrawal for {isbn:string}?",
		cancel: "Cancel",
		confirm: "Confirm",
		description:
			"This book is out of stock. If you're certain additional copies exist, you can manually select a warehouse to force the withdrawal.",
		selected_warehouse_message:
			"A stock adjustment will be recorded for {quantity:number} {{copy|copies}} of {isbn:string} in {displayName:string}."
	},
	create_custom_item_dialog: {
		title: "Create custom item"
	},
	edit_custom_item_dialog: {
		title: "Edit custom item"
	},
	labels: {
		new_note: "New Note",
		edit: "Edit",
		print_book_label: "Print book label",
		delete_row: "Delete row",
		edit_row: "Edit row",
		delete: "Delete",
		commit: "Commit",
		print: "Print",
		custom_item: "Custom item",
		force_withdrawal: "Force withdrawal"
	},
	stats: {
		last_updated: "Last updated",
		books: "{ bookCount } book{{s}}"
	},
	placeholder: {
		select_warehouse: "Please select a warehouse",
		any_warehouse: "Any warehouse",
		no_warehouses: "No available warehouses",
		scan_title: "Scan to select books from...",
		scan_description: "Plugin your barcode scanner and pull the trigger"
	},
	alerts: {
		insufficient_quantity:
			"The warehouse you're attempting to assign to has no more available quantity, click Force Withdrawal to select another warehouse",
		no_warehouse_selected_commit_self: "Please make sure all items have an assigned warehouse."
	}
};

const sale_page = {
	heading: "Sale",
	stats: {
		last_updated: "Last updated",
		books: "{ bookCount } book{{s}}"
	},
	labels: {
		new_sale: "New Sale",
		edit: "Edit",
		print_book_label: "Print book label",
		delete_row: "Delete row",
		no_open_sales: "No open sales",
		get_started: "Get started by adding a new sale"
	}
};
const stock_page = {
	labels: {
		edit_book_details: "Edit book details",
		manually_edit_book_details: "Manually edit book details",
		edit_row: "Edit row",
		print_book_label: "Print book label",
		popover_control: "Row actions"
	},
	placeholder_box: {
		no_results: {
			title: "No results",
			description: "Search found no results"
		}
	}
};

const settings_page = {
	headings: {
		settings: "Settings",
		device_settings: "Device settings",
		sync_settings: "Sync settings",
		db_management: "Database management",

		demo_reset: "Reset the DB to initial state ?"
	},
	descriptions: {
		sync_settings: "Manage DB name, sync URL and the connection. Note: This will be merged with DB selection in the future",
		db_management: "Use this section to create, select, import, export or delete a database",
		import: "Drag and drop your .sqlite3 file here to import",
		device_settings: "Manage connections to external devices",

		demo_reset_1: "Click on the button below to reset the DB to initial state",
		demo_reset_2: "All changes made will be lost and the DB will be reset to initial demo state."
	},
	actions: {
		nuke_and_resync: "Nuke and resync"
	},
	demo_actions: {
		reset_db: "Reset database"
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
		supplier_id: "Order ID",
		supplier: "Supplier Name",
		books: "Books",
		finalized: "Finalised",
		actions: "Actions",
		view_order: "View Order",
		view_reconciliation: "View Reconciliation"
	},
	ordered_table: {
		order_id: "Order ID",
		select: "Select",
		supplier: "Supplier Name",
		placed: "Placed",
		actions: "Actions",
		reconcile_selected: "Reconcile {count:number} order{{s}}",
		view_order: "View Order",
		reconcile: "Reconcile",
		view_reconciliation: "View Reconciliation"
	},
	reconciling_table: {
		order_id: "Reconciliation ID",
		supplier_orders: "Supplier Orders",
		last_updated: "Last Updated",
		update_order: "Update order",
		continue: "Continue",
		actions: "Actions"
	},
	unordered_table: {
		supplier_id: "Supplier ID",
		supplier: "Supplier Name",
		books: "No. of Books",
		place_order: "Place Order",
		actions: "Actions"
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
			row_actions: "Row Actions",
			type: "Type"
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
		}
	}
};

const misc_components = {
	extension_banner: {
		book_data_extension: "Book Data Extension",
		remote_db: "Remote DB",
		reload_translations_override: "Reload translations overrides"
	},
	page_layout: {
		stock: "Stock",
		checkout: "Checkout"
	},
	warehouse_select: {
		label: {
			aria: "Select a warehouse to withdraw book {rowIx:number} from",
			forced: "Forced",
			book_count: "{count:number} {{copy|copies}} available"
		},
		default_option: "Select a warehouse",
		empty_options: "No stock available..."
	}
};

const error_page = {
	title: "Error",
	message: {
		title: "Something crashed!",
		description: "Try checking your internet connection if you're using an online database."
	}
};

const layout = {
	mobile_nav: {
		trigger: {
			aria_label: "Open mobile navigation"
		},
		dialog: {
			title: "Mobile Navigation",
			description: "Navigate through the application"
		}
	},
	sync_dialog: {
		title: "Sync in progress",
		description: {
			in_progress: "The initial DB sync is in progress. This might take a while",
			progress: "Progress ({nProcessed}/{nTotal}):",
			warning:
				"Please don't navigate away while the sync is in progress as it will result in broken DB and the sync will need to be restarted."
		}
	},
	error_dialog: {
		demo_db_not_initialised: {
			title: "Load the DB with data",
			call_to_action: "Click on the button below to load the DB prepupulated with demo data",
			description: "This will download the demo DB .sqlite3 file and store it to browser's OPFS (for in app usage)",
			button: "Load DB"
		},
		schema_mismatch: {
			title: "Error: DB Schema mismatch",
			description: "Your DB's schema version doesn't match the latest schema version. Click automigrate to migrate to the latest version.",
			latest_version: "Latest schema version: {wantVersion}",
			your_version: "Your DB schema version: {gotVersion}",
			button: "Automigrate"
		},
		corrupted: {
			title: "Error: DB corrupted",
			description: "The only way to use the app seems to be to delete it and start fresh.",
			note: "Note: This won't resync the database. If you want to sync up the DB with the remote one, please do so on the settings page (after reinitialisation)",
			button: "Click to delete the DB"
		},
		sync_stuck: {
			title: "Sync connection issue",
			description: "The sync connection is not working.",
			call_to_action: "Clear your local database and re-sync from the server to fix this.",
			button: "Nuke and Resync",
			diagnostics: {
				title: "Detected issue:",
				rapid_closes: "Connection failed {count} time{{s}} immediately after opening.",
				timeout: "Connection did not stabilize within the expected time.",
				repeated_disconnects: "Connection dropped {count} time{{s}} without staying connected.",
				hint: "The server database was likely rebuilt. Your local data needs to be re-synced."
			}
		}
	},
	runtime_error_toast: {
		title: "An unexpected error occurred",
		description: "If it persists, try reloading the page."
	}
};

const forms = {
	sync_settings: {
		labels: {
			database_name: "Database Name (this will probably change in the future)",
			remote_sync_url: "Remote Sync Database URL",
			save_reload: "Save and Reload",
			connection_status: {
				on: "ON",
				off: "OFF"
			}
		},
		aria: {
			form: "Edit remote database connection config"
		}
	},
	device_settings: {
		labels: {
			label_printer_url: "Label Printer URL",
			receipt_printer_url: "Receipt Printer URL",
			save_reload: "Save and Reload"
		},
		aria: {
			form: "Edit remote database connection config"
		}
	},
	database_delete: {
		labels: {
			confirm_typing: "Confirm by typing database name",
			type_instruction: "Type '{matchConfirmation}'",
			confirm_button: "Confirm"
		}
	},
	warehouse_delete: {
		labels: {
			confirm_typing: "Confirm by typing warehouse name",
			type_instruction: "Type '{matchConfirmation}'",
			confirm_button: "Confirm",
			cancel_button: "Cancel"
		}
	},
	supplier_meta: {
		labels: {
			name: "Name",
			email: "Email",
			address: "Address",
			customer_id: "Customer ID",
			cancel_button: "Cancel",
			order_format: "Order Format",
			order_format_message: "Please select an order format"
		},
		aria: {
			form: "Edit customer order name, email or deposit"
		}
	},
	book_form: {
		labels: {
			isbn: "ISBN",
			fill_details: "Fill details",
			title: "Title",
			price: "Price",
			year: "Year",
			authors: "Authors",
			publisher: "Publisher",
			edited_by: "Edited by",
			category: "Category",
			out_of_print: "Out of Print",
			out_of_print_help: "This book is no longer available from the publisher",
			cancel_button: "Cancel",
			save_button: "Save"
		},
		placeholders: {
			isbn: "0000000000"
		},
		aria: {
			form: "Edit book details"
		}
	},
	daisy_ui_book_form: {
		labels: {
			isbn: "ISBN",
			fill_details: "Fill details",
			title: "Title",
			price: "Price",
			year: "Year",
			authors: "Authors",
			publisher: "Publisher",
			edited_by: "Edited by",
			category: "Category",
			out_of_print: "Out of Print",
			cancel_button: "Cancel",
			save_button: "Save"
		},
		placeholders: {
			isbn: "0000000000"
		},
		aria: {
			form: "Edit book details"
		}
	},
	scanner_form: {
		placeholders: {
			isbn: "Enter ISBN of ordered books"
		}
	},
	daisy_ui_scanner_form: {
		placeholders: {
			isbn: "Enter ISBN of ordered books"
		}
	},
	customer_order_meta: {
		labels: {
			display_id: "Display ID",
			name: "Name",
			email: "Email",
			deposit: "Deposit",
			phone1: "Phone 1",
			phone2: "Phone 2",
			cancel_button: "Cancel"
		},
		validation: {
			display_id_not_unique: 'This ID is already in use by customer "{fullname}" with {bookCount} ordered book{{s}}'
		},
		aria: {
			form: "Edit customer order name, email or deposit"
		}
	},
	database_create: {
		labels: {
			name: "Name",
			cancel_button: "Cancel",
			save_button: "Save"
		},
		placeholders: {
			name: "Database name"
		},
		aria: {
			form: "Create new database"
		}
	},
	warehouse_form: {
		labels: {
			name: "Name",
			discount: "Discount",
			discount_help: "Applied to book prices",
			cancel_button: "Cancel",
			save_button: "Save"
		},
		placeholders: {
			name: "Warehouse name",
			discount: "0"
		},
		aria: {
			form: "Edit warehouse details"
		}
	},
	custom_item_form: {
		labels: {
			title: "Title",
			price: "Price",
			cancel_button: "Cancel",
			save_button: "Save"
		},
		placeholders: {
			price: "0"
		},
		aria: {
			form: "Edit book details"
		}
	}
};

const en = {
	nav,
	page_headings,
	search,
	history_page,
	inventory_page,
	orders_page,
	customer_orders_page,
	suppliers_page,
	warehouse_list_page,
	warehouse_page,
	sale_note,
	sale_page,
	purchase_note,
	settings_page,
	stock_page,
	common,
	supplier_orders_page,
	new_order_page,
	reconcile_page,
	order_page,
	reconciled_list_page,
	order_list_page,
	supplier_orders_component,
	table_components,
	misc_components,
	layout,
	error_page,
	books_page,
	debug_page,
	forms
} satisfies BaseTranslation;

export default en;
