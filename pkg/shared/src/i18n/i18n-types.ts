// This file was auto-generated by 'typesafe-i18n'. Any manual changes will be overwritten.
/* eslint-disable */
import type { BaseTranslation as BaseTranslationType, LocalizedString, RequiredParams } from "typesafe-i18n";

export type BaseTranslation = BaseTranslationType;
export type BaseLocale = "en";

export type Locales = "de" | "en";

export type Translation = RootTranslation;

export type Translations = RootTranslation;

type RootTranslation = {
	nav: {
		/**
		 * S​e​a​r​c​h​ ​s​t​o​c​k
		 */
		search: string;
		/**
		 * V​i​e​w​ ​k​n​o​w​n​ ​b​o​o​k​s
		 */
		books: string;
		/**
		 * M​a​n​a​g​e​ ​i​n​v​e​n​t​o​r​y
		 */
		inventory: string;
		/**
		 * O​u​t​b​o​u​n​d
		 */
		outbound: string;
		/**
		 * I​n​b​o​u​n​d
		 */
		inbound: string;
		/**
		 * S​e​t​t​i​n​g​s
		 */
		settings: string;
		/**
		 * H​i​s​t​o​r​y
		 */
		history: string;
		/**
		 * S​u​p​p​l​i​e​r​s​ ​o​r​d​e​r​s
		 */
		supplier_orders: string;
	};
	search: {
		/**
		 * S​e​a​r​c​h
		 */
		title: string;
		empty: {
			/**
			 * S​e​a​r​c​h​ ​f​o​r​ ​s​t​o​c​k
			 */
			title: string;
			/**
			 * G​e​t​ ​s​t​a​r​t​e​d​ ​b​y​ ​s​e​a​r​c​h​i​n​g​ ​b​y​ ​t​i​t​l​e​,​ ​a​u​t​h​o​r​,​ ​I​S​B​N
			 */
			description: string;
		};
	};
	history_page: {
		date_tab: {
			stats: {
				/**
				 * S​t​a​t​s
				 */
				title: string;
				/**
				 * I​n​b​o​u​n​d​ ​B​o​o​k​ ​C​o​u​n​t
				 */
				total_inbound_book_count: string;
				/**
				 * I​n​b​o​u​n​d​ ​C​o​v​e​r​ ​P​r​i​c​e
				 */
				total_inbound_cover_price: string;
				/**
				 * I​n​b​o​u​n​d​ ​D​i​s​c​o​u​n​t​e​d​ ​P​r​i​c​e
				 */
				total_inbound_discounted_price: string;
				/**
				 * O​u​t​b​o​u​n​d​ ​B​o​o​k​ ​C​o​u​n​t
				 */
				total_outbound_book_count: string;
				/**
				 * O​u​t​b​o​u​n​d​ ​C​o​v​e​r​ ​P​r​i​c​e
				 */
				total_outbound_cover_price: string;
				/**
				 * O​u​t​b​o​u​n​d​ ​D​i​s​c​o​u​n​t​e​d​ ​P​r​i​c​e
				 */
				total_outbound_discounted_price: string;
			};
			transactions: {
				/**
				 * T​r​a​n​s​a​c​t​i​o​n​s
				 */
				title: string;
				/**
				 * C​o​m​m​i​t​t​e​d
				 */
				committed: string;
			};
		};
		isbn_tab: {
			titles: {
				/**
				 * T​r​a​n​s​a​c​t​i​o​n​s
				 */
				transactions: string;
				/**
				 * H​i​s​t​o​r​y
				 */
				history: string;
			};
			isbn_id: {
				titles: {
					/**
					 * S​t​o​c​k
					 */
					stock: string;
				};
				placeholder_box: {
					/**
					 * N​o​ ​t​r​a​n​s​a​c​t​i​o​n​s​ ​f​o​u​n​d
					 */
					title: string;
					/**
					 * T​h​e​r​e​ ​s​e​e​m​s​ ​t​o​ ​b​e​ ​n​o​ ​r​e​c​o​r​d​ ​o​f​ ​t​r​a​n​s​a​c​t​i​o​n​s​ ​f​o​r​ ​t​h​e​ ​g​i​v​e​n​ ​i​s​b​n​ ​v​o​l​u​m​e​s​ ​g​o​i​n​g​ ​i​n​ ​o​r​ ​o​u​t
					 */
					description: string;
				};
			};
			placeholder_box: {
				/**
				 * N​o​ ​b​o​o​k​ ​s​e​l​e​c​t​e​d
				 */
				title: string;
				/**
				 * U​s​e​ ​t​h​e​ ​s​e​a​r​c​h​ ​f​i​e​l​d​ ​t​o​ ​f​i​n​d​ ​t​h​e​ ​b​o​o​k​ ​y​o​u​'​r​e​ ​l​o​o​k​i​n​g​ ​f​o​r
				 */
				description: string;
			};
		};
		notes_tab: {
			date: {
				/**
				 * H​i​s​t​o​r​y
				 */
				history: string;
				/**
				 * B​o​o​k​s
				 */
				books: string;
				/**
				 * T​o​t​a​l​ ​c​o​v​e​r​ ​p​r​i​c​e
				 */
				total_cover_price: string;
				/**
				 * C​o​m​m​i​t​t​e​d
				 */
				committed: string;
				/**
				 * T​o​t​a​l​ ​d​i​s​c​o​u​n​t​e​d​ ​p​r​i​c​e
				 */
				total_discounted_price: string;
			};
			archive: {
				/**
				 * C​o​m​m​i​t​t​e​d​ ​A​t
				 */
				committed_at: string;
				/**
				 * E​x​p​o​r​t​ ​C​S​V
				 */
				export_csv: string;
			};
		};
		warehouse_tab: {
			note_table: {
				filter_options: {
					/**
					 * A​l​l
					 */
					all: string;
					/**
					 * I​n​b​o​u​n​d
					 */
					inbound: string;
					/**
					 * O​u​t​b​o​u​n​d
					 */
					outbound: string;
				};
				column_headers: {
					/**
					 * q​u​a​n​t​i​t​y
					 */
					quantity: string;
					/**
					 * i​s​b​n
					 */
					isbn: string;
					/**
					 * t​i​t​l​e
					 */
					title: string;
					/**
					 * p​u​b​l​i​s​h​e​r
					 */
					publisher: string;
					/**
					 * a​u​t​h​o​r​s
					 */
					authors: string;
					/**
					 * y​e​a​r
					 */
					year: string;
					/**
					 * p​r​i​c​e
					 */
					price: string;
					/**
					 * c​a​t​e​g​o​r​y
					 */
					category: string;
					/**
					 * e​d​i​t​e​d​_​b​y
					 */
					edited_by: string;
					/**
					 * o​u​t​_​o​f​_​p​r​i​n​t
					 */
					out_of_print: string;
				};
				heading: {
					/**
					 * h​i​s​t​o​r​y
					 */
					history: string;
					/**
					 * E​x​p​o​r​t​ ​C​S​V
					 */
					export_csv: string;
					/**
					 * F​r​o​m
					 */
					from: string;
					/**
					 * T​o
					 */
					to: string;
					/**
					 * F​i​l​t​e​r
					 */
					filter: string;
				};
				titles: {
					/**
					 * T​r​a​n​s​a​c​t​i​o​n​s
					 */
					transactions: string;
				};
			};
			stats: {
				/**
				 * {​n​o​_​o​f​_​b​o​o​k​s​}​ ​b​o​o​k​{​{​s​}​}
				 * @param {string | number | boolean} no_of_books
				 */
				books: RequiredParams<"no_of_books">;
				/**
				 * d​i​s​c​o​u​n​t
				 */
				discount: string;
			};
		};
	};
	inventory_page: {
		inbound_tab: {
			placeholder_box: {
				/**
				 * N​o​ ​o​p​e​n​ ​n​o​t​e​s
				 */
				title: string;
				/**
				 * G​e​t​ ​s​t​a​r​t​e​d​ ​b​y​ ​a​d​d​i​n​g​ ​a​ ​n​e​w​ ​n​o​t​e​ ​w​i​t​h​ ​t​h​e​ ​a​p​p​r​o​p​r​i​a​t​e​ ​w​a​r​e​h​o​u​s​e
				 */
				description: string;
			};
			stats: {
				/**
				 * B​a​c​k​ ​t​o​ ​w​a​r​e​h​o​u​s​e​s
				 */
				back_to_warehouses: string;
				/**
				 * {​n​o​_​o​f​_​b​o​o​k​s​}​ ​b​o​o​k​{​{​s​}​}
				 * @param {string | number | boolean} no_of_books
				 */
				books: RequiredParams<"no_of_books">;
				/**
				 * L​a​s​t​ ​U​p​d​a​t​e​d
				 */
				last_updated: string;
			};
			labels: {
				/**
				 * E​d​i​t
				 */
				button_edit: string;
			};
		};
	};
	orders_page: {
		labels: {
			/**
			 * C​h​e​c​k​o​u​t
			 */
			checkout: string;
			/**
			 * C​r​e​a​t​e​ ​a​ ​n​e​w​ ​O​u​t​b​o​u​n​d​ ​N​o​t​e
			 */
			create_outbound_note: string;
		};
	};
	customer_orders_page: {
		/**
		 * C​u​s​t​o​m​e​r​ ​O​r​d​e​r​s
		 */
		title: string;
		labels: {
			/**
			 * N​e​w​ ​O​r​d​e​r
			 */
			new_order: string;
			/**
			 * U​p​d​a​t​e​ ​O​r​d​e​r
			 */
			update_order: string;
			/**
			 * U​p​d​a​t​e
			 */
			update: string;
		};
		tabs: {
			/**
			 * I​n​ ​P​r​o​g​r​e​s​s
			 */
			in_progress: string;
			/**
			 * C​o​m​p​l​e​t​e​d
			 */
			completed: string;
		};
		table: {
			/**
			 * C​u​s​t​o​m​e​r
			 */
			customer: string;
			/**
			 * O​r​d​e​r​ ​I​D
			 */
			order_id: string;
			/**
			 * C​u​s​t​o​m​e​r​ ​D​e​t​a​i​l​s
			 */
			customer_details: string;
		};
	};
	suppliers_page: {
		labels: {
			/**
			 * N​e​w​ ​S​u​p​p​l​i​e​r
			 */
			new_supplier: string;
		};
		title: {
			/**
			 * S​u​p​p​l​i​e​r​s
			 */
			suppliers: string;
		};
		table: {
			/**
			 * D​e​l​e​t​e
			 */
			delete: string;
			/**
			 * E​d​i​t
			 */
			edit: string;
		};
	};
	warehouse_list_page: {
		stats: {
			/**
			 * b​o​o​k​s
			 */
			books: string;
			/**
			 * d​i​s​c​o​u​n​t
			 */
			discount: string;
		};
		labels: {
			/**
			 * N​e​w​ ​n​o​t​e
			 */
			new_note: string;
			/**
			 * V​i​e​w​ ​S​t​o​c​k
			 */
			view_stock: string;
		};
	};
	warehouse_page: {
		table: {
			/**
			 * Q​u​a​n​t​i​t​y
			 */
			quantity: string;
			/**
			 * I​S​B​N
			 */
			isbn: string;
			/**
			 * T​i​t​l​e
			 */
			title: string;
			/**
			 * P​u​b​l​i​s​h​e​r
			 */
			publisher: string;
			/**
			 * A​u​t​h​o​r​s
			 */
			authors: string;
			/**
			 * Y​e​a​r
			 */
			year: string;
			/**
			 * P​r​i​c​e
			 */
			price: string;
			/**
			 * C​a​t​e​g​o​r​y
			 */
			category: string;
			/**
			 * E​d​i​t​e​d​ ​b​y
			 */
			edited_by: string;
			/**
			 * O​u​t​ ​o​f​ ​p​r​i​n​t
			 */
			out_of_print: string;
		};
		labels: {
			/**
			 * E​x​p​o​r​t​ ​t​o​ ​C​S​V
			 */
			export_to_csv: string;
			/**
			 * N​e​w​ ​n​o​t​e
			 */
			new_note: string;
			/**
			 * E​d​i​t​ ​r​o​w
			 */
			edit_row: string;
			/**
			 * P​r​i​n​t​ ​b​o​o​k​ ​l​a​b​e​l
			 */
			print_book_label: string;
			/**
			 * E​d​i​t​ ​b​o​o​k​ ​d​e​t​a​i​l​s
			 */
			edit_book_details: string;
			/**
			 * M​a​n​u​a​l​l​y​ ​e​d​i​t​ ​b​o​o​k​ ​d​e​t​a​i​l​s
			 */
			manually_edit_book_details: string;
		};
	};
	outbound_note: {
		delete_dialog: {
			/**
			 * P​l​e​a​s​e​ ​s​e​l​e​c​t​ ​a​ ​w​a​r​e​h​o​u​s​e​ ​f​o​r​ ​e​a​c​h​ ​o​f​ ​t​h​e​ ​f​o​l​l​o​w​i​n​g​ ​t​r​a​n​s​a​c​t​i​o​n​s
			 */
			select_warehouse: string;
		};
		reconcile_dialog: {
			/**
			 * P​l​e​a​s​e​ ​r​e​v​i​e​w​ ​t​h​e​ ​f​o​l​l​o​w​i​n​g​ ​t​r​a​n​s​a​c​t​i​o​n​s
			 */
			review_transaction: string;
			/**
			 * q​u​a​n​t​i​t​y​ ​f​o​r​ ​r​e​c​o​n​c​i​l​i​a​t​i​o​n
			 */
			quantity: string;
		};
		labels: {
			/**
			 * N​e​w​ ​N​o​t​e
			 */
			new_note: string;
			/**
			 * E​d​i​t
			 */
			edit: string;
			/**
			 * P​r​i​n​t​ ​b​o​o​k​ ​l​a​b​e​l
			 */
			print_book_label: string;
			/**
			 * D​e​l​e​t​e​ ​r​o​w
			 */
			delete_row: string;
			/**
			 * E​d​i​t​ ​r​o​w
			 */
			edit_row: string;
			/**
			 * D​e​l​e​t​e
			 */
			delete: string;
		};
		stats: {
			/**
			 * L​a​s​t​ ​u​p​d​a​t​e​d
			 */
			last_updated: string;
			/**
			 * {​b​o​o​k​C​o​u​n​t​}​ ​b​o​o​k​{​{​s​}​}
			 * @param {string | number | boolean} bookCount
			 */
			books: RequiredParams<"bookCount">;
		};
	};
	outbound_page: {
		/**
		 * O​u​t​b​o​u​n​d
		 */
		heading: string;
		stats: {
			/**
			 * L​a​s​t​ ​u​p​d​a​t​e​d
			 */
			last_updated: string;
			/**
			 * {​b​o​o​k​C​o​u​n​t​}​ ​b​o​o​k​{​{​s​}​}
			 * @param {string | number | boolean} bookCount
			 */
			books: RequiredParams<"bookCount">;
		};
		labels: {
			/**
			 * N​e​w​ ​N​o​t​e
			 */
			new_note: string;
			/**
			 * E​d​i​t
			 */
			edit: string;
			/**
			 * P​r​i​n​t​ ​b​o​o​k​ ​l​a​b​e​l
			 */
			print_book_label: string;
			/**
			 * D​e​l​e​t​e​ ​r​o​w
			 */
			delete_row: string;
		};
	};
	inbound_note: {
		stats: {
			/**
			 * L​a​s​t​ ​u​p​d​a​t​e​d
			 */
			last_updated: string;
		};
		labels: {
			/**
			 * C​o​m​m​i​t
			 */
			commit: string;
			/**
			 * P​r​i​n​t
			 */
			print: string;
			/**
			 * A​u​t​o​ ​p​r​i​n​t​ ​b​o​o​k​ ​l​a​b​e​l​s
			 */
			auto_print_book_labels: string;
			/**
			 * D​e​l​e​t​e
			 */
			delete: string;
			/**
			 * E​d​i​t​ ​r​o​w
			 */
			edit_row: string;
			/**
			 * P​r​i​n​t​ ​b​o​o​k​ ​l​a​b​e​l
			 */
			print_book_label: string;
			/**
			 * D​e​l​e​t​e​ ​r​o​w
			 */
			delete_row: string;
		};
	};
	settings_page: {
		headings: {
			/**
			 * S​e​t​t​i​n​g​s
			 */
			settings: string;
			/**
			 * D​e​v​i​c​e​ ​s​e​t​t​i​n​g​s
			 */
			device_settings: string;
			/**
			 * S​y​n​c​ ​s​e​t​t​i​n​g​s
			 */
			sync_settings: string;
			/**
			 * D​a​t​a​b​a​s​e​ ​m​a​n​a​g​e​m​e​n​t
			 */
			db_management: string;
		};
		descriptions: {
			/**
			 * M​a​n​a​g​e​ ​D​B​ ​n​a​m​e​,​ ​s​y​n​c​ ​U​R​L​ ​a​n​d​ ​t​h​e​ ​c​o​n​n​e​c​t​i​o​n​.​ ​N​o​t​e​:​ ​T​h​i​s​ ​w​i​l​l​ ​b​e​ ​m​e​r​g​e​d​ ​w​i​t​h​ ​D​B​ ​s​e​l​e​c​t​i​o​n​ ​i​n​ ​t​h​e​ ​f​u​t​u​r​e
			 */
			sync_settings: string;
			/**
			 * U​s​e​ ​t​h​i​s​ ​s​e​c​t​i​o​n​ ​t​o​ ​c​r​e​a​t​e​,​ ​s​e​l​e​c​t​,​ ​i​m​p​o​r​t​,​ ​e​x​p​o​r​t​ ​o​r​ ​d​e​l​e​t​e​ ​a​ ​d​a​t​a​b​a​s​e
			 */
			db_management: string;
			/**
			 * D​r​a​g​ ​a​n​d​ ​d​r​o​p​ ​y​o​u​r​ ​.​s​q​l​i​t​e​3​ ​f​i​l​e​ ​h​e​r​e​ ​t​o​ ​i​m​p​o​r​t
			 */
			import: string;
			/**
			 * M​a​n​a​g​e​ ​c​o​n​n​e​c​t​i​o​n​s​ ​t​o​ ​e​x​t​e​r​n​a​l​ ​d​e​v​i​c​e​s
			 */
			device_settings: string;
		};
		stats: {
			/**
			 * V​e​r​s​i​o​n
			 */
			version: string;
		};
		labels: {
			/**
			 * N​e​w
			 */
			new: string;
		};
	};
	stock_page: {
		labels: {
			/**
			 * E​d​i​t​ ​b​o​o​k​ ​d​e​t​a​i​l​s
			 */
			edit_book_details: string;
			/**
			 * M​a​n​u​a​l​l​y​ ​e​d​i​t​ ​b​o​o​k​ ​d​e​t​a​i​l​s
			 */
			manually_edit_book_details: string;
			/**
			 * E​d​i​t​ ​r​o​w
			 */
			edit_row: string;
			/**
			 * P​r​i​n​t​ ​b​o​o​k​ ​l​a​b​e​l
			 */
			print_book_label: string;
		};
	};
	common: {
		delete_dialog: {
			/**
			 * P​e​r​m​e​n​a​n​t​l​y​ ​d​e​l​e​t​e​ ​{​e​n​t​i​t​y​}​?
			 * @param {unknown} entity
			 */
			title: RequiredParams<"entity">;
			/**
			 * O​n​c​e​ ​y​o​u​ ​d​e​l​e​t​e​ ​t​h​i​s​ ​n​o​t​e​,​ ​y​o​u​ ​w​i​l​l​ ​n​o​t​ ​b​e​ ​a​b​l​e​ ​t​o​ ​a​c​c​e​s​s​ ​i​t​ ​a​g​a​i​n
			 */
			description: string;
		};
		commit_inbound_dialog: {
			/**
			 * C​o​m​m​i​t​ ​i​n​b​o​u​n​d​ ​{​e​n​t​i​t​y​}​?
			 * @param {unknown} entity
			 */
			title: RequiredParams<"entity">;
			/**
			 * {​b​o​o​k​C​o​u​n​t​}​ ​b​o​o​k​{​{​s​}​}​ ​w​i​l​l​ ​b​e​ ​a​d​d​e​d​ ​t​o​ ​{​w​a​r​e​h​o​u​s​e​N​a​m​e​}
			 * @param {string | number | boolean} bookCount
			 * @param {unknown} warehouseName
			 */
			description: RequiredParams<"bookCount" | "warehouseName">;
		};
		commit_outbound_dialog: {
			/**
			 * C​o​m​m​i​t​ ​o​u​t​b​o​u​n​d​ ​{​e​n​t​i​t​y​}​?
			 * @param {unknown} entity
			 */
			title: RequiredParams<"entity">;
			/**
			 * {​b​o​o​k​C​o​u​n​t​}​ ​b​o​o​k​{​{​s​}​}​ ​w​i​l​l​ ​b​e​ ​r​e​m​o​v​e​d​ ​f​r​o​m​ ​y​o​u​r​ ​s​t​o​c​k
			 * @param {string | number | boolean} bookCount
			 */
			description: RequiredParams<"bookCount">;
		};
		no_warehouse_dialog: {
			/**
			 * N​o​ ​w​a​r​e​h​o​u​s​e​(​s​)​ ​s​e​l​e​c​t​e​d
			 */
			title: string;
			/**
			 * C​a​n​'​t​ ​c​o​m​m​i​t​ ​t​h​e​ ​n​o​t​e​ ​a​s​ ​s​o​m​e​ ​t​r​a​n​s​a​c​t​i​o​n​s​ ​d​o​n​'​t​ ​h​a​v​e​ ​a​n​y​ ​w​a​r​e​h​o​u​s​e​ ​s​e​l​e​c​t​e​d
			 */
			description: string;
		};
		reconcile_outbound_dialog: {
			/**
			 * S​t​o​c​k​ ​m​i​s​m​a​t​c​h
			 */
			title: string;
			/**
			 * S​o​m​e​ ​q​u​a​n​t​i​t​i​e​s​ ​r​e​q​u​e​s​t​e​d​ ​a​r​e​ ​g​r​e​a​t​e​r​ ​t​h​a​n​ ​a​v​a​i​l​a​b​l​e​ ​i​n​ ​s​t​o​c​k​ ​a​n​d​ ​w​i​l​l​ ​n​e​e​d​ ​t​o​ ​b​e​ ​r​e​c​o​n​c​i​l​e​d​ ​i​n​ ​o​r​d​e​r​ ​t​o​ ​p​r​o​c​e​e​d​.
			 */
			description: string;
		};
		edit_book_dialog: {
			/**
			 * E​d​i​t​ ​b​o​o​k​ ​d​e​t​a​i​l​s
			 */
			title: string;
			/**
			 * U​p​d​a​t​e​ ​b​o​o​k​ ​d​e​t​a​i​l​s
			 */
			description: string;
		};
		create_custom_item_dialog: {
			/**
			 * C​r​e​a​t​e​ ​c​u​s​t​o​m​ ​i​t​e​m
			 */
			title: string;
		};
		edit_custom_item_dialog: {
			/**
			 * E​d​i​t​ ​c​u​s​t​o​m​ ​i​t​e​m
			 */
			title: string;
		};
		edit_warehouse_dialog: {
			/**
			 * U​p​d​a​t​e​ ​w​a​r​e​h​o​u​s​e​ ​d​e​t​a​i​l​s
			 */
			title: string;
			/**
			 * U​p​d​a​t​e​ ​w​a​r​e​h​o​u​s​e​ ​d​e​t​a​i​l​s
			 */
			description: string;
		};
		delete_warehouse_dialog: {
			/**
			 * O​n​c​e​ ​y​o​u​ ​d​e​l​e​t​e​ ​t​h​i​s​ ​w​a​r​e​h​o​u​s​e​ ​{​b​o​o​k​C​o​u​n​t​}​ ​b​o​o​k​{​{​s​}​}​ ​w​i​l​l​ ​b​e​ ​r​e​m​o​v​e​d​ ​f​r​o​m​ ​y​o​u​r​ ​s​t​o​c​k
			 * @param {string | number | boolean} bookCount
			 */
			description: RequiredParams<"bookCount">;
		};
		delete_database_dialog: {
			/**
			 * O​n​c​e​ ​y​o​u​ ​d​e​l​e​t​e​ ​t​h​i​s​ ​d​a​t​a​b​a​s​e​ ​i​t​ ​c​a​n​'​t​ ​b​e​ ​r​e​s​t​o​r​e​d​.​ ​I​n​ ​o​r​d​e​r​ ​t​o​ ​s​a​v​e​ ​t​h​e​ ​b​a​c​k​u​p​ ​f​i​r​s​t​,​ ​p​l​e​a​s​e​ ​u​s​e​ ​t​h​e​ ​e​x​p​o​r​t​ ​b​u​t​t​o​n​.
			 */
			description: string;
		};
		create_database_dialog: {
			/**
			 * C​r​e​a​t​e​ ​n​e​w​ ​d​a​t​a​b​a​s​e
			 */
			title: string;
			/**
			 * P​l​e​a​s​e​ ​t​y​p​e​ ​i​n​ ​t​h​e​ ​n​a​m​e​ ​f​o​r​ ​t​h​e​ ​n​e​w​ ​d​a​t​a​b​a​s​e
			 */
			description: string;
		};
	};
	supplier_orders_page: {
		title: {
			/**
			 * S​u​p​p​l​i​e​r​ ​O​r​d​e​r​s
			 */
			supplier_orders: string;
		};
		labels: {
			/**
			 * S​u​p​p​l​i​e​r​s
			 */
			suppliers: string;
		};
		tabs: {
			/**
			 * U​n​o​r​d​e​r​e​d
			 */
			unordered: string;
			/**
			 * O​r​d​e​r​e​d
			 */
			ordered: string;
			/**
			 * R​e​c​o​n​c​i​l​i​n​g
			 */
			reconciling: string;
			/**
			 * C​o​m​p​l​e​t​e​d
			 */
			completed: string;
		};
		placeholder: {
			/**
			 * N​o​ ​u​n​o​r​d​e​r​e​d​ ​s​u​p​p​l​i​e​r​ ​o​r​d​e​r​s​ ​a​v​a​i​l​a​b​l​e​.​ ​C​r​e​a​t​e​ ​a​ ​c​u​s​t​o​m​e​r​ ​o​r​d​e​r​ ​f​i​r​s​t​ ​t​o​ ​g​e​n​e​r​a​t​e​ ​s​u​p​p​l​i​e​r​ ​o​r​d​e​r​s​.
			 */
			description: string;
			/**
			 * N​e​w​ ​C​u​s​t​o​m​e​r​ ​O​r​d​e​r
			 */
			button: string;
		};
	};
	new_order_page: {
		stats: {
			/**
			 * T​o​t​a​l​ ​b​o​o​k​s
			 */
			total_books: string;
			/**
			 * T​o​t​a​l​ ​v​a​l​u​e
			 */
			total_value: string;
			/**
			 * S​e​l​e​c​t​e​d​ ​b​o​o​k​s
			 */
			selected_books: string;
		};
		table: {
			/**
			 * O​r​d​e​r​e​d​ ​q​u​a​n​t​i​t​y
			 */
			ordered_quantity: string;
			/**
			 * T​o​t​a​l
			 */
			total: string;
			/**
			 * S​e​l​e​c​t​e​d​ ​q​u​a​n​t​i​t​y
			 */
			selected_quantity: string;
			/**
			 * B​o​o​k​s
			 */
			books: string;
			/**
			 * I​S​B​N
			 */
			isbn: string;
			/**
			 * T​i​t​l​e
			 */
			title: string;
			/**
			 * A​u​t​h​o​r​s
			 */
			authors: string;
		};
		labels: {
			/**
			 * S​e​l​e​c​t
			 */
			select: string;
			/**
			 * P​l​a​c​e​ ​O​r​d​e​r
			 */
			place_order: string;
		};
	};
	reconcile_page: {
		title: {
			/**
			 * R​e​c​o​n​c​i​l​e​ ​D​e​l​i​v​e​r​i​e​s
			 */
			reconcile_deliveries: string;
		};
		stats: {
			/**
			 * C​r​e​a​t​e​d
			 */
			created: string;
			/**
			 * L​a​s​t​ ​U​p​d​a​t​e​d
			 */
			last_updated: string;
			/**
			 * I​n​c​l​u​d​e​s​ ​s​u​p​p​l​i​e​r​ ​o​r​d​e​r​s
			 */
			includes_supplier_orders: string;
			/**
			 * T​o​t​a​l​ ​d​e​l​i​v​e​r​e​d
			 */
			total_delivered: string;
		};
		placeholder: {
			/**
			 * S​c​a​n​ ​o​r​ ​e​n​t​e​r​ ​t​h​e​ ​I​S​B​N​s​ ​o​f​ ​t​h​e​ ​d​e​l​i​v​e​r​e​d​ ​b​o​o​k​s​ ​t​o​ ​b​e​g​i​n​ ​r​e​c​o​n​c​i​l​i​a​t​i​o​n​.
			 */
			description: string;
		};
		table: {
			/**
			 * I​S​B​N
			 */
			isbn: string;
			/**
			 * T​i​t​l​e
			 */
			title: string;
			/**
			 * A​u​t​h​o​r​s
			 */
			authors: string;
			/**
			 * Q​u​a​n​t​i​t​y
			 */
			quantity: string;
			/**
			 * P​r​i​c​e
			 */
			price: string;
		};
		delete_dialog: {
			/**
			 * D​e​l​e​t​e​ ​R​e​c​o​n​c​i​l​i​a​t​i​o​n​ ​O​r​d​e​r
			 */
			title: string;
			/**
			 * A​r​e​ ​y​o​u​ ​s​u​r​e​ ​y​o​u​ ​w​a​n​t​ ​t​o​ ​d​e​l​e​t​e​ ​t​h​i​s​ ​r​e​c​o​n​c​i​l​i​a​t​i​o​n​ ​o​r​d​e​r​?​ ​T​h​i​s​ ​a​c​t​i​o​n​ ​w​i​l​l​ ​d​e​l​e​t​e​ ​a​l​l​ ​t​h​e​ ​s​c​a​n​n​e​d​ ​l​i​n​e​s​.
			 */
			description: string;
		};
	};
	reconciled_list_page: {
		labels: {
			/**
			 * V​i​e​w​ ​R​e​c​o​n​c​i​l​i​a​t​i​o​n
			 */
			view_reconciliation: string;
			/**
			 * R​e​c​o​n​c​i​l​e
			 */
			reconcile: string;
			/**
			 * P​r​i​n​t​ ​O​r​d​e​r
			 */
			print_order: string;
		};
		stats: {
			/**
			 * T​o​t​a​l​ ​b​o​o​k​s
			 */
			total_books: string;
			/**
			 * O​r​d​e​r​e​d
			 */
			ordered: string;
			/**
			 * T​o​t​a​l​ ​v​a​l​u​e
			 */
			total_value: string;
		};
		table: {
			/**
			 * B​o​o​k​s
			 */
			books: string;
			/**
			 * I​S​B​N
			 */
			isbn: string;
			/**
			 * T​i​t​l​e
			 */
			title: string;
			/**
			 * A​u​t​h​o​r​s
			 */
			authors: string;
			/**
			 * Q​u​a​n​t​i​t​y
			 */
			quantity: string;
			/**
			 * T​o​t​a​l​ ​P​r​i​c​e
			 */
			total_price: string;
		};
	};
	order_list_page: {
		labels: {
			/**
			 * R​e​m​o​v​e​ ​p​u​b​l​i​s​h​e​r
			 */
			remove_publisher: string;
			/**
			 * C​r​e​a​t​e​ ​n​e​w​ ​o​r​d​e​r
			 */
			create_new_order: string;
			/**
			 * A​d​d​ ​t​o​ ​s​u​p​p​l​i​e​r
			 */
			add_to_supplier: string;
		};
		details: {
			/**
			 * S​u​p​p​l​i​e​r​ ​p​a​g​e
			 */
			supplier_page: string;
			/**
			 * S​u​p​p​l​i​e​r​ ​n​a​m​e
			 */
			supplier_name: string;
			/**
			 * S​u​p​p​l​i​e​r​ ​a​d​d​r​e​s​s
			 */
			supplier_address: string;
			/**
			 * S​u​p​p​l​i​e​r​ ​e​m​a​i​l
			 */
			supplier_email: string;
		};
		table: {
			/**
			 * P​u​b​l​i​s​h​e​r​ ​n​a​m​e
			 */
			publisher_name: string;
			/**
			 * A​s​s​i​g​n​e​d​ ​p​u​b​l​i​s​h​e​r​s
			 */
			assigned_publishers: string;
			/**
			 * U​n​a​s​s​i​g​n​e​d​ ​p​u​b​l​i​s​h​e​r​s
			 */
			unassigned_publishers: string;
		};
	};
};

export type TranslationFunctions = {
	nav: {
		/**
		 * Search stock
		 */
		search: () => LocalizedString;
		/**
		 * View known books
		 */
		books: () => LocalizedString;
		/**
		 * Manage inventory
		 */
		inventory: () => LocalizedString;
		/**
		 * Outbound
		 */
		outbound: () => LocalizedString;
		/**
		 * Inbound
		 */
		inbound: () => LocalizedString;
		/**
		 * Settings
		 */
		settings: () => LocalizedString;
		/**
		 * History
		 */
		history: () => LocalizedString;
		/**
		 * Suppliers orders
		 */
		supplier_orders: () => LocalizedString;
	};
	search: {
		/**
		 * Search
		 */
		title: () => LocalizedString;
		empty: {
			/**
			 * Search for stock
			 */
			title: () => LocalizedString;
			/**
			 * Get started by searching by title, author, ISBN
			 */
			description: () => LocalizedString;
		};
	};
	history_page: {
		date_tab: {
			stats: {
				/**
				 * Stats
				 */
				title: () => LocalizedString;
				/**
				 * Inbound Book Count
				 */
				total_inbound_book_count: () => LocalizedString;
				/**
				 * Inbound Cover Price
				 */
				total_inbound_cover_price: () => LocalizedString;
				/**
				 * Inbound Discounted Price
				 */
				total_inbound_discounted_price: () => LocalizedString;
				/**
				 * Outbound Book Count
				 */
				total_outbound_book_count: () => LocalizedString;
				/**
				 * Outbound Cover Price
				 */
				total_outbound_cover_price: () => LocalizedString;
				/**
				 * Outbound Discounted Price
				 */
				total_outbound_discounted_price: () => LocalizedString;
			};
			transactions: {
				/**
				 * Transactions
				 */
				title: () => LocalizedString;
				/**
				 * Committed
				 */
				committed: () => LocalizedString;
			};
		};
		isbn_tab: {
			titles: {
				/**
				 * Transactions
				 */
				transactions: () => LocalizedString;
				/**
				 * History
				 */
				history: () => LocalizedString;
			};
			isbn_id: {
				titles: {
					/**
					 * Stock
					 */
					stock: () => LocalizedString;
				};
				placeholder_box: {
					/**
					 * No transactions found
					 */
					title: () => LocalizedString;
					/**
					 * There seems to be no record of transactions for the given isbn volumes going in or out
					 */
					description: () => LocalizedString;
				};
			};
			placeholder_box: {
				/**
				 * No book selected
				 */
				title: () => LocalizedString;
				/**
				 * Use the search field to find the book you're looking for
				 */
				description: () => LocalizedString;
			};
		};
		notes_tab: {
			date: {
				/**
				 * History
				 */
				history: () => LocalizedString;
				/**
				 * Books
				 */
				books: () => LocalizedString;
				/**
				 * Total cover price
				 */
				total_cover_price: () => LocalizedString;
				/**
				 * Committed
				 */
				committed: () => LocalizedString;
				/**
				 * Total discounted price
				 */
				total_discounted_price: () => LocalizedString;
			};
			archive: {
				/**
				 * Committed At
				 */
				committed_at: () => LocalizedString;
				/**
				 * Export CSV
				 */
				export_csv: () => LocalizedString;
			};
		};
		warehouse_tab: {
			note_table: {
				filter_options: {
					/**
					 * All
					 */
					all: () => LocalizedString;
					/**
					 * Inbound
					 */
					inbound: () => LocalizedString;
					/**
					 * Outbound
					 */
					outbound: () => LocalizedString;
				};
				column_headers: {
					/**
					 * quantity
					 */
					quantity: () => LocalizedString;
					/**
					 * isbn
					 */
					isbn: () => LocalizedString;
					/**
					 * title
					 */
					title: () => LocalizedString;
					/**
					 * publisher
					 */
					publisher: () => LocalizedString;
					/**
					 * authors
					 */
					authors: () => LocalizedString;
					/**
					 * year
					 */
					year: () => LocalizedString;
					/**
					 * price
					 */
					price: () => LocalizedString;
					/**
					 * category
					 */
					category: () => LocalizedString;
					/**
					 * edited_by
					 */
					edited_by: () => LocalizedString;
					/**
					 * out_of_print
					 */
					out_of_print: () => LocalizedString;
				};
				heading: {
					/**
					 * history
					 */
					history: () => LocalizedString;
					/**
					 * Export CSV
					 */
					export_csv: () => LocalizedString;
					/**
					 * From
					 */
					from: () => LocalizedString;
					/**
					 * To
					 */
					to: () => LocalizedString;
					/**
					 * Filter
					 */
					filter: () => LocalizedString;
				};
				titles: {
					/**
					 * Transactions
					 */
					transactions: () => LocalizedString;
				};
			};
			stats: {
				/**
				 * {no_of_books} book{{s}}
				 */
				books: (arg: { no_of_books: string | number | boolean }) => LocalizedString;
				/**
				 * discount
				 */
				discount: () => LocalizedString;
			};
		};
	};
	inventory_page: {
		inbound_tab: {
			placeholder_box: {
				/**
				 * No open notes
				 */
				title: () => LocalizedString;
				/**
				 * Get started by adding a new note with the appropriate warehouse
				 */
				description: () => LocalizedString;
			};
			stats: {
				/**
				 * Back to warehouses
				 */
				back_to_warehouses: () => LocalizedString;
				/**
				 * {no_of_books} book{{s}}
				 */
				books: (arg: { no_of_books: string | number | boolean }) => LocalizedString;
				/**
				 * Last Updated
				 */
				last_updated: () => LocalizedString;
			};
			labels: {
				/**
				 * Edit
				 */
				button_edit: () => LocalizedString;
			};
		};
	};
	orders_page: {
		labels: {
			/**
			 * Checkout
			 */
			checkout: () => LocalizedString;
			/**
			 * Create a new Outbound Note
			 */
			create_outbound_note: () => LocalizedString;
		};
	};
	customer_orders_page: {
		/**
		 * Customer Orders
		 */
		title: () => LocalizedString;
		labels: {
			/**
			 * New Order
			 */
			new_order: () => LocalizedString;
			/**
			 * Update Order
			 */
			update_order: () => LocalizedString;
			/**
			 * Update
			 */
			update: () => LocalizedString;
		};
		tabs: {
			/**
			 * In Progress
			 */
			in_progress: () => LocalizedString;
			/**
			 * Completed
			 */
			completed: () => LocalizedString;
		};
		table: {
			/**
			 * Customer
			 */
			customer: () => LocalizedString;
			/**
			 * Order ID
			 */
			order_id: () => LocalizedString;
			/**
			 * Customer Details
			 */
			customer_details: () => LocalizedString;
		};
	};
	suppliers_page: {
		labels: {
			/**
			 * New Supplier
			 */
			new_supplier: () => LocalizedString;
		};
		title: {
			/**
			 * Suppliers
			 */
			suppliers: () => LocalizedString;
		};
		table: {
			/**
			 * Delete
			 */
			delete: () => LocalizedString;
			/**
			 * Edit
			 */
			edit: () => LocalizedString;
		};
	};
	warehouse_list_page: {
		stats: {
			/**
			 * books
			 */
			books: () => LocalizedString;
			/**
			 * discount
			 */
			discount: () => LocalizedString;
		};
		labels: {
			/**
			 * New note
			 */
			new_note: () => LocalizedString;
			/**
			 * View Stock
			 */
			view_stock: () => LocalizedString;
		};
	};
	warehouse_page: {
		table: {
			/**
			 * Quantity
			 */
			quantity: () => LocalizedString;
			/**
			 * ISBN
			 */
			isbn: () => LocalizedString;
			/**
			 * Title
			 */
			title: () => LocalizedString;
			/**
			 * Publisher
			 */
			publisher: () => LocalizedString;
			/**
			 * Authors
			 */
			authors: () => LocalizedString;
			/**
			 * Year
			 */
			year: () => LocalizedString;
			/**
			 * Price
			 */
			price: () => LocalizedString;
			/**
			 * Category
			 */
			category: () => LocalizedString;
			/**
			 * Edited by
			 */
			edited_by: () => LocalizedString;
			/**
			 * Out of print
			 */
			out_of_print: () => LocalizedString;
		};
		labels: {
			/**
			 * Export to CSV
			 */
			export_to_csv: () => LocalizedString;
			/**
			 * New note
			 */
			new_note: () => LocalizedString;
			/**
			 * Edit row
			 */
			edit_row: () => LocalizedString;
			/**
			 * Print book label
			 */
			print_book_label: () => LocalizedString;
			/**
			 * Edit book details
			 */
			edit_book_details: () => LocalizedString;
			/**
			 * Manually edit book details
			 */
			manually_edit_book_details: () => LocalizedString;
		};
	};
	outbound_note: {
		delete_dialog: {
			/**
			 * Please select a warehouse for each of the following transactions
			 */
			select_warehouse: () => LocalizedString;
		};
		reconcile_dialog: {
			/**
			 * Please review the following transactions
			 */
			review_transaction: () => LocalizedString;
			/**
			 * quantity for reconciliation
			 */
			quantity: () => LocalizedString;
		};
		labels: {
			/**
			 * New Note
			 */
			new_note: () => LocalizedString;
			/**
			 * Edit
			 */
			edit: () => LocalizedString;
			/**
			 * Print book label
			 */
			print_book_label: () => LocalizedString;
			/**
			 * Delete row
			 */
			delete_row: () => LocalizedString;
			/**
			 * Edit row
			 */
			edit_row: () => LocalizedString;
			/**
			 * Delete
			 */
			delete: () => LocalizedString;
		};
		stats: {
			/**
			 * Last updated
			 */
			last_updated: () => LocalizedString;
			/**
			 * {bookCount} book{{s}}
			 */
			books: (arg: { bookCount: string | number | boolean }) => LocalizedString;
		};
	};
	outbound_page: {
		/**
		 * Outbound
		 */
		heading: () => LocalizedString;
		stats: {
			/**
			 * Last updated
			 */
			last_updated: () => LocalizedString;
			/**
			 * {bookCount} book{{s}}
			 */
			books: (arg: { bookCount: string | number | boolean }) => LocalizedString;
		};
		labels: {
			/**
			 * New Note
			 */
			new_note: () => LocalizedString;
			/**
			 * Edit
			 */
			edit: () => LocalizedString;
			/**
			 * Print book label
			 */
			print_book_label: () => LocalizedString;
			/**
			 * Delete row
			 */
			delete_row: () => LocalizedString;
		};
	};
	inbound_note: {
		stats: {
			/**
			 * Last updated
			 */
			last_updated: () => LocalizedString;
		};
		labels: {
			/**
			 * Commit
			 */
			commit: () => LocalizedString;
			/**
			 * Print
			 */
			print: () => LocalizedString;
			/**
			 * Auto print book labels
			 */
			auto_print_book_labels: () => LocalizedString;
			/**
			 * Delete
			 */
			delete: () => LocalizedString;
			/**
			 * Edit row
			 */
			edit_row: () => LocalizedString;
			/**
			 * Print book label
			 */
			print_book_label: () => LocalizedString;
			/**
			 * Delete row
			 */
			delete_row: () => LocalizedString;
		};
	};
	settings_page: {
		headings: {
			/**
			 * Settings
			 */
			settings: () => LocalizedString;
			/**
			 * Device settings
			 */
			device_settings: () => LocalizedString;
			/**
			 * Sync settings
			 */
			sync_settings: () => LocalizedString;
			/**
			 * Database management
			 */
			db_management: () => LocalizedString;
		};
		descriptions: {
			/**
			 * Manage DB name, sync URL and the connection. Note: This will be merged with DB selection in the future
			 */
			sync_settings: () => LocalizedString;
			/**
			 * Use this section to create, select, import, export or delete a database
			 */
			db_management: () => LocalizedString;
			/**
			 * Drag and drop your .sqlite3 file here to import
			 */
			import: () => LocalizedString;
			/**
			 * Manage connections to external devices
			 */
			device_settings: () => LocalizedString;
		};
		stats: {
			/**
			 * Version
			 */
			version: () => LocalizedString;
		};
		labels: {
			/**
			 * New
			 */
			new: () => LocalizedString;
		};
	};
	stock_page: {
		labels: {
			/**
			 * Edit book details
			 */
			edit_book_details: () => LocalizedString;
			/**
			 * Manually edit book details
			 */
			manually_edit_book_details: () => LocalizedString;
			/**
			 * Edit row
			 */
			edit_row: () => LocalizedString;
			/**
			 * Print book label
			 */
			print_book_label: () => LocalizedString;
		};
	};
	common: {
		delete_dialog: {
			/**
			 * Permenantly delete {entity}?
			 */
			title: (arg: { entity: unknown }) => LocalizedString;
			/**
			 * Once you delete this note, you will not be able to access it again
			 */
			description: () => LocalizedString;
		};
		commit_inbound_dialog: {
			/**
			 * Commit inbound {entity}?
			 */
			title: (arg: { entity: unknown }) => LocalizedString;
			/**
			 * {bookCount} book{{s}} will be added to {warehouseName}
			 */
			description: (arg: { bookCount: string | number | boolean; warehouseName: unknown }) => LocalizedString;
		};
		commit_outbound_dialog: {
			/**
			 * Commit outbound {entity}?
			 */
			title: (arg: { entity: unknown }) => LocalizedString;
			/**
			 * {bookCount} book{{s}} will be removed from your stock
			 */
			description: (arg: { bookCount: string | number | boolean }) => LocalizedString;
		};
		no_warehouse_dialog: {
			/**
			 * No warehouse(s) selected
			 */
			title: () => LocalizedString;
			/**
			 * Can't commit the note as some transactions don't have any warehouse selected
			 */
			description: () => LocalizedString;
		};
		reconcile_outbound_dialog: {
			/**
			 * Stock mismatch
			 */
			title: () => LocalizedString;
			/**
			 * Some quantities requested are greater than available in stock and will need to be reconciled in order to proceed.
			 */
			description: () => LocalizedString;
		};
		edit_book_dialog: {
			/**
			 * Edit book details
			 */
			title: () => LocalizedString;
			/**
			 * Update book details
			 */
			description: () => LocalizedString;
		};
		create_custom_item_dialog: {
			/**
			 * Create custom item
			 */
			title: () => LocalizedString;
		};
		edit_custom_item_dialog: {
			/**
			 * Edit custom item
			 */
			title: () => LocalizedString;
		};
		edit_warehouse_dialog: {
			/**
			 * Update warehouse details
			 */
			title: () => LocalizedString;
			/**
			 * Update warehouse details
			 */
			description: () => LocalizedString;
		};
		delete_warehouse_dialog: {
			/**
			 * Once you delete this warehouse {bookCount} book{{s}} will be removed from your stock
			 */
			description: (arg: { bookCount: string | number | boolean }) => LocalizedString;
		};
		delete_database_dialog: {
			/**
			 * Once you delete this database it can't be restored. In order to save the backup first, please use the export button.
			 */
			description: () => LocalizedString;
		};
		create_database_dialog: {
			/**
			 * Create new database
			 */
			title: () => LocalizedString;
			/**
			 * Please type in the name for the new database
			 */
			description: () => LocalizedString;
		};
	};
	supplier_orders_page: {
		title: {
			/**
			 * Supplier Orders
			 */
			supplier_orders: () => LocalizedString;
		};
		labels: {
			/**
			 * Suppliers
			 */
			suppliers: () => LocalizedString;
		};
		tabs: {
			/**
			 * Unordered
			 */
			unordered: () => LocalizedString;
			/**
			 * Ordered
			 */
			ordered: () => LocalizedString;
			/**
			 * Reconciling
			 */
			reconciling: () => LocalizedString;
			/**
			 * Completed
			 */
			completed: () => LocalizedString;
		};
		placeholder: {
			/**
			 * No unordered supplier orders available. Create a customer order first to generate supplier orders.
			 */
			description: () => LocalizedString;
			/**
			 * New Customer Order
			 */
			button: () => LocalizedString;
		};
	};
	new_order_page: {
		stats: {
			/**
			 * Total books
			 */
			total_books: () => LocalizedString;
			/**
			 * Total value
			 */
			total_value: () => LocalizedString;
			/**
			 * Selected books
			 */
			selected_books: () => LocalizedString;
		};
		table: {
			/**
			 * Ordered quantity
			 */
			ordered_quantity: () => LocalizedString;
			/**
			 * Total
			 */
			total: () => LocalizedString;
			/**
			 * Selected quantity
			 */
			selected_quantity: () => LocalizedString;
			/**
			 * Books
			 */
			books: () => LocalizedString;
			/**
			 * ISBN
			 */
			isbn: () => LocalizedString;
			/**
			 * Title
			 */
			title: () => LocalizedString;
			/**
			 * Authors
			 */
			authors: () => LocalizedString;
		};
		labels: {
			/**
			 * Select
			 */
			select: () => LocalizedString;
			/**
			 * Place Order
			 */
			place_order: () => LocalizedString;
		};
	};
	reconcile_page: {
		title: {
			/**
			 * Reconcile Deliveries
			 */
			reconcile_deliveries: () => LocalizedString;
		};
		stats: {
			/**
			 * Created
			 */
			created: () => LocalizedString;
			/**
			 * Last Updated
			 */
			last_updated: () => LocalizedString;
			/**
			 * Includes supplier orders
			 */
			includes_supplier_orders: () => LocalizedString;
			/**
			 * Total delivered
			 */
			total_delivered: () => LocalizedString;
		};
		placeholder: {
			/**
			 * Scan or enter the ISBNs of the delivered books to begin reconciliation.
			 */
			description: () => LocalizedString;
		};
		table: {
			/**
			 * ISBN
			 */
			isbn: () => LocalizedString;
			/**
			 * Title
			 */
			title: () => LocalizedString;
			/**
			 * Authors
			 */
			authors: () => LocalizedString;
			/**
			 * Quantity
			 */
			quantity: () => LocalizedString;
			/**
			 * Price
			 */
			price: () => LocalizedString;
		};
		delete_dialog: {
			/**
			 * Delete Reconciliation Order
			 */
			title: () => LocalizedString;
			/**
			 * Are you sure you want to delete this reconciliation order? This action will delete all the scanned lines.
			 */
			description: () => LocalizedString;
		};
	};
	reconciled_list_page: {
		labels: {
			/**
			 * View Reconciliation
			 */
			view_reconciliation: () => LocalizedString;
			/**
			 * Reconcile
			 */
			reconcile: () => LocalizedString;
			/**
			 * Print Order
			 */
			print_order: () => LocalizedString;
		};
		stats: {
			/**
			 * Total books
			 */
			total_books: () => LocalizedString;
			/**
			 * Ordered
			 */
			ordered: () => LocalizedString;
			/**
			 * Total value
			 */
			total_value: () => LocalizedString;
		};
		table: {
			/**
			 * Books
			 */
			books: () => LocalizedString;
			/**
			 * ISBN
			 */
			isbn: () => LocalizedString;
			/**
			 * Title
			 */
			title: () => LocalizedString;
			/**
			 * Authors
			 */
			authors: () => LocalizedString;
			/**
			 * Quantity
			 */
			quantity: () => LocalizedString;
			/**
			 * Total Price
			 */
			total_price: () => LocalizedString;
		};
	};
	order_list_page: {
		labels: {
			/**
			 * Remove publisher
			 */
			remove_publisher: () => LocalizedString;
			/**
			 * Create new order
			 */
			create_new_order: () => LocalizedString;
			/**
			 * Add to supplier
			 */
			add_to_supplier: () => LocalizedString;
		};
		details: {
			/**
			 * Supplier page
			 */
			supplier_page: () => LocalizedString;
			/**
			 * Supplier name
			 */
			supplier_name: () => LocalizedString;
			/**
			 * Supplier address
			 */
			supplier_address: () => LocalizedString;
			/**
			 * Supplier email
			 */
			supplier_email: () => LocalizedString;
		};
		table: {
			/**
			 * Publisher name
			 */
			publisher_name: () => LocalizedString;
			/**
			 * Assigned publishers
			 */
			assigned_publishers: () => LocalizedString;
			/**
			 * Unassigned publishers
			 */
			unassigned_publishers: () => LocalizedString;
		};
	};
};

export type Formatters = {};
