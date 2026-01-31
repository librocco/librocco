<script lang="ts">
	import Plus from "$lucide/plus";
	import RotateCcw from "$lucide/rotate-ccw";
	import Play from "$lucide/play";
	import BookPlus from "$lucide/book-plus";
	import AlertTriangle from "$lucide/alert-triangle";
	import Unplug from "$lucide/unplug";

	import { onMount } from "svelte";

	import { wrapIter } from "@librocco/shared";

	import type { LayoutData } from "../$types";

	import { upsertBook } from "$lib/db/cr-sqlite/books";
	import {
		createReconciliationOrder,
		finalizeReconciliationOrder,
		upsertReconciliationOrderLines
	} from "$lib/db/cr-sqlite/order-reconciliation";
	import { associatePublisher, createSupplierOrder, upsertSupplier } from "$lib/db/cr-sqlite/suppliers";
	import { addBooksToCustomer, upsertCustomer } from "$lib/db/cr-sqlite/customers";

	import { goto } from "$lib/utils/navigation";

	import { debugData as dd } from "$lib/__testData__/debugData";
	import { LL } from "@librocco/shared/i18n-svelte";

	import { app } from "$lib/app";
	import { getDb } from "$lib/app/db";

	export let data: LayoutData;

	let book;
	let supplier;
	let supplier_publisher;
	let customer;
	let customer_order_lines;
	let supplier_order;
	let supplier_order_line;
	let reconciliation_order;
	let reconciliation_order_lines;

	let isLoading = true;

	let query = "SELECT * FROM book LIMIT 10;";
	let queryResult = null;
	let errorMessage = null;

	const tableData = [
		{ label: "Books", value: () => book },
		{ label: "Suppliers", value: () => supplier },
		{ label: "Supplier Publishers", value: () => supplier_publisher },
		{ label: "Customers", value: () => customer },
		{ label: "Customer Order Lines", value: () => customer_order_lines },
		{ label: "Supplier Orders", value: () => supplier_order },
		{ label: "Supplier Order Lines", value: () => supplier_order_line },
		{ label: "Reconciliation Orders", value: () => reconciliation_order },
		{ label: "Reconciliation Order Lines", value: () => reconciliation_order_lines }
	];

	// Function to generate random ISBN (10 digits)
	function generateRandomISBN() {
		return Math.floor(1000000000 + Math.random() * 9000000000).toString();
	}

	// Function to generate a random price between $5 and $50
	function generateRandomPrice() {
		return (5 + Math.random() * 45).toFixed(2);
	}
	// Function to generate deterministic ISBN based on index
	function generateDeterministicISBN(index) {
		// Pad the index to 10 digits with leading zeros
		return `9780000${index.toString().padStart(5, "0")}`;
	}

	// Function to generate deterministic price based on index
	function generateDeterministicPrice(index) {
		// Price between $10 and $50 based on index
		return (10 + (index % 41)).toFixed(2);
	}

	// Function to upsert 100 books with different publishers
	async function upsert100Books() {
		isLoading = true;
		errorMessage = null;

		const db = await getDb(app);

		try {
			// Create an array of 100 book objects with deterministic values
			const books = Array.from({ length: 100 }, (_, i) => {
				const bookNumber = i + 1;
				return {
					isbn: generateDeterministicISBN(bookNumber),
					title: `Test Book ${bookNumber}`,
					authors: `Author ${bookNumber}`,
					publisher: `Publisher ${bookNumber}`,
					price: generateDeterministicPrice(bookNumber),
					year: 2023
				};
			});

			// Insert each book
			for (const book of books) {
				await db.exec(`
                     INSERT INTO book (isbn, title, authors, publisher, price, year)
                     VALUES (
                         '${book.isbn}',
                         '${book.title}',
                         '${book.authors}',
                         '${book.publisher}',
                         ${book.price},
                         ${book.year}
                     )
                     ON CONFLICT(isbn) DO UPDATE SET
                         title = '${book.title}',
                         authors = '${book.authors}',
                         publisher = '${book.publisher}',
                         price = ${book.price},
                         year = ${book.year}
                 `);
			}

			// Also create supplier entries for each publisher with deterministic ID
			for (let i = 1; i <= 100; i++) {
				const supplierId = i;
				const publisherName = `Publisher ${i}`;

				// Insert supplier
				await db.exec(`
                     INSERT INTO supplier (id, name, email, address, customerId)
                     VALUES (
                         ${supplierId},
                         '${publisherName} Distribution',
                         'contact@${publisherName.toLowerCase().replace(/\s+/g, "")}.com',
                         '${i} Publisher Street, Book City',
                         ${supplierId}${i}
                     )
                     ON CONFLICT(id) DO UPDATE SET
                         name = '${publisherName} Distribution',
                         email = 'contact@${publisherName.toLowerCase().replace(/\s+/g, "")}.com',
                         address = '${i} Publisher Street, Book City',
                         customerId = ${supplierId}${i}
                 `);

				// Link publisher to supplier
				await db.exec(`
                     INSERT INTO supplier_publisher (supplier_id, publisher)
                     VALUES (${supplierId}, '${publisherName}')
                     ON CONFLICT(publisher) DO NOTHING
                 `);
			}

			console.log("Successfully upserted 100 books with different publishers");
		} catch (error) {
			console.error("Error upserting books:", error);
			errorMessage = error;
		} finally {
			isLoading = false;
			await loadData();
		}
	}

	const populateDatabase = async function () {
		errorMessage = null;
		console.log("Populating database");

		const db = await getDb(app);

		try {
			// Books
			for (const book of dd.books) {
				await upsertBook(db, book);
			}

			// Customers
			for (const customer of dd.customers) {
				await upsertCustomer(db, customer);
			}

			// Group order lines by customer_id for quicker (batched) updates
			const customerOrderLines = wrapIter(dd.customerOrderLines)._groupIntoMap(({ customer_id, isbn }) => [customer_id, isbn]);
			// Add supplier order lines to their respective customer orders
			for (const [customer_id, isbns] of customerOrderLines.entries()) {
				await addBooksToCustomer(db, customer_id, [...isbns]);
			}

			// Suppliers
			for (const supplier of dd.suppliers) {
				await upsertSupplier(db, supplier);
			}

			for (const { supplierId, publisher } of dd.supplierPublishers) {
				await associatePublisher(db, supplierId, publisher);
			}

			// Group supplier order lines by supplier orders
			const supplierOrderMap = wrapIter(dd.supplierOrderLines)._groupIntoMap((line) => [line.supplier_order_id, line]);
			// Create supplier orders
			for (const [supplierOrderId, orderLines] of supplierOrderMap.entries()) {
				const lines = [...orderLines];

				// NOTE: supplier id should be the same for every line in the order if this is not the case, the handler will throw
				const [{ supplier_id }] = lines;

				await createSupplierOrder(db, supplierOrderId, supplier_id, lines);
			}

			// Group reconciliation order lines by reconciliation orders
			const reconOrderLineMap = wrapIter(dd.reconciliationOrderLines)._groupIntoMap(({ reconciliation_order_id, ...line }) => [
				reconciliation_order_id,
				line
			]);

			// Add reconciliation orders and lines
			for (const order of dd.reconciliationOrders) {
				await createReconciliationOrder(db, order.id, order.supplier_order_ids);

				// Add lines (if any)
				const lines = reconOrderLineMap.get(order.id);
				if (lines) {
					await upsertReconciliationOrderLines(db, order.id, [...lines]);
				}

				// Finalize order if so specified in the test data
				if (order.finalized) {
					await finalizeReconciliationOrder(db, order.id);
				}
			}

			console.log("Finished populating database.");
		} catch (error) {
			errorMessage = error;
		} finally {
			await loadData();
		}
	};

	const resetDatabase = async function resetDatabase() {
		errorMessage = null;

		const db = await getDb(app);

		const tables = [
			"book",
			"supplier",
			"supplier_publisher",
			"customer",
			"customer_order_lines",
			"supplier_order",
			"supplier_order_line",
			"reconciliation_order",
			"reconciliation_order_lines"
		];
		console.log("Resetting database");

		await Promise.all(
			tables.map(async (table) => {
				console.log(`Clearing ${table}`);
				await db.exec(`DELETE FROM ${table}`);
			})
		);
		await loadData();
	};

	const loadData = async function () {
		console.log("Loading database");

		isLoading = true;

		const db = await getDb(app);

		book = await db.exec("SELECT COUNT(*) from book;");
		supplier = await db.exec("SELECT COUNT(*) from supplier;");
		supplier_publisher = await db.exec("SELECT COUNT(*) from supplier_publisher;");
		customer = await db.exec("SELECT COUNT(*) from customer;");
		customer_order_lines = await db.exec("SELECT COUNT(*) from customer_order_lines;");
		supplier_order = await db.exec("SELECT COUNT(*) from supplier_order;");
		supplier_order_line = await db.exec("SELECT COUNT(*) from supplier_order_line;");
		reconciliation_order = await db.exec("SELECT COUNT(*) from reconciliation_order;");
		reconciliation_order_lines = await db.exec("SELECT COUNT(*) from reconciliation_order_lines;");
		isLoading = false;
	};

	async function executeQuery() {
		isLoading = true;
		errorMessage = null;

		const db = await getDb(app);

		try {
			queryResult = await db.execO(query);
		} catch (error) {
			errorMessage = error;
		} finally {
			isLoading = false;
		}
		await loadData();
	}

	onMount(async function () {
		await loadData();
	});

	const triggerLoadError = () => goto("#/load_error");

	const throwError = () => {
		throw new Error($LL.debug_page.labels.runtime_error());
	};

	/**
	 * Corrupts the local database's sync identity by changing its site_id.
	 * This simulates the state where the local DB is incompatible with the server
	 * (e.g., after a server database rebuild), triggering the sync stuck detection.
	 */
	const corruptSyncState = async () => {
		isLoading = true;
		errorMessage = null;

		const db = await getDb(app);

		try {
			// Generate a new random site_id (16 bytes)
			const newSiteId = new Uint8Array(16);
			crypto.getRandomValues(newSiteId);

			// Update the site_id in crsql_site_id table (ordinal 0 is "myself")
			await db.exec("UPDATE crsql_site_id SET site_id = ? WHERE ordinal = 0", [newSiteId]);

			console.log("Sync state corrupted - site_id changed to:", newSiteId);
			alert("Sync state corrupted! Reload the page to trigger sync stuck detection.");
		} catch (error) {
			console.error("Error corrupting sync state:", error);
			errorMessage = error;
		} finally {
			isLoading = false;
		}
	};

	let error = false;
</script>

<div id="content" class="h-full w-full overflow-y-auto">
	<header class="flex h-16 items-center justify-between border-b border-base-content">
		<h2 class="pl-[70px] text-lg font-medium lg:pl-5">{$LL.debug_page.title()}</h2>
	</header>

	<div class="flex h-full w-full flex-col px-4">
		<div class="flex items-center justify-between self-end p-4">
			<div class="gap-2">
				<button class="btn-primary btn" on:click={triggerLoadError}>
					<AlertTriangle size={20} />
					{$LL.debug_page.actions.trigger_load_error()}
				</button>
				<button class="btn-primary btn" on:click={throwError}>
					<AlertTriangle size={20} />
					{$LL.debug_page.actions.trigger_runtime_error()}
				</button>
				<button class="btn-warning btn" on:click={corruptSyncState}>
					<Unplug size={20} />
					{$LL.debug_page.actions.corrupt_sync_state()}
				</button>
			</div>
		</div>

		<div class="flex items-center justify-between self-end p-4">
			<div class="gap-2">
				<button class="btn-primary btn" on:click={() => populateDatabase()}>
					<Plus size={20} />
					{$LL.debug_page.actions.populate_database()}
				</button>
				<button class="btn-primary btn" on:click={() => resetDatabase()}>
					<RotateCcw size={20} />
					{$LL.debug_page.actions.reset_database()}
				</button>
				<button class="btn-primary btn" on:click={() => upsert100Books()}>
					<BookPlus size={20} />
					{$LL.debug_page.actions.upsert_100_books()}
				</button>
			</div>
		</div>

		<div class="flex py-2">
			<div class="mr-5 flex-auto overflow-x-auto py-2">
				<h2 class="prose font-bold">{$LL.debug_page.query_interface.title()}</h2>
				<div class="mr-5 flex flex-col py-2">
					<textarea bind:value={query} id="query"></textarea>

					<button class="btn-primary btn" on:click={executeQuery} disabled={isLoading}>
						<Play size={20} />
						{isLoading ? $LL.debug_page.actions.executing() : $LL.debug_page.actions.run_query()}
					</button>

					{#if queryResult || errorMessage}
						<h2 class="prose mt-3 font-bold">{$LL.debug_page.query_interface.results_title()}</h2>

						{#if errorMessage}
							<div class="mt-4 rounded-lg bg-red-500 p-3 text-white shadow">
								{errorMessage}
							</div>
						{:else if queryResult.length === 0}
							<p>{$LL.debug_page.query_interface.no_results()}</p>
						{:else}
							<table class="table">
								<thead>
									<tr>
										{#each Object.keys(queryResult[0]) as column}
											<th scope="col">{column}</th>
										{/each}
									</tr>
								</thead>
								<tbody>
									{#each queryResult as row}
										<tr class="hover focus-within:bg-base-200">
											{#each Object.values(row) as value}
												<td>{value}</td>
											{/each}
										</tr>
									{/each}
								</tbody>
							</table>
						{/if}
					{/if}
				</div>
			</div>
			<div class="w-64 overflow-x-auto py-2">
				<table class="table">
					<thead>
						<tr>
							<th scope="col">{$LL.debug_page.table.title()}</th>
							<th scope="col">{$LL.debug_page.table.number_of_objects()}</th>
						</tr>
					</thead>
					<tbody>
						{#each tableData as row}
							<tr class="hover focus-within:bg-base-200">
								<td>{row.label}</td>
								<td>
									{#if isLoading}
										<div class="spinner"></div>
									{:else}
										{row.value()}
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>
	</div>
</div>

{#if error}
	{@html (() => {
		throw new Error("Kaboom! Render time error");
	})()}
{/if}

<style>
	.spinner {
		width: 10px;
		height: 10px;
		border: 5px solid rgba(0, 0, 0, 0.1);
		border-top-color: #333;
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}

	textarea {
		width: 100%;
		height: 100px;
		font-size: 1rem;
		padding: 0.5rem;
		margin-bottom: 0.5rem;
		border: solid 1px;
	}
</style>
