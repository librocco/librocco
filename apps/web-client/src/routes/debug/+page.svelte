<script lang="ts">
	import { BookCopy, Library, PackageMinus, Search, Settings, PersonStanding, Book, Truck } from "lucide-svelte";
	import { Plus, RotateCcw, Play } from "lucide-svelte";
	import { LL } from "$i18n/i18n-svelte";
	import { appPath } from "$lib/paths";
	import { TooltipWrapper } from "$lib/components";
	import { onMount } from "svelte";
	import { page } from "$app/stores";
	import { getInitializedDB } from "$lib/db/cr-sqlite";
	import { dbNamePersisted } from "$lib/db";

	import debugData from "$lib/__testData__/debugData.sql?raw";
	import { debugData as dd } from "$lib/__testData__/debugData";
	import { upsertBook } from "$lib/db/cr-sqlite/books";
	import { addBooksToCustomer, upsertCustomer } from "$lib/db/cr-sqlite/customers";
	import {
		associatePublishers,
		createReconciliationOrders,
		createSupplierOrders,
		upsertBooks,
		upsertCustomers,
		upsertMultipleReconciliationOrderLines,
		upsertSuppliers
	} from "$lib/__testData__/debugHandlers";

	$: ({ nav: tNav } = $LL);

	interface Link {
		label: string;
		href: string;
		icon: any;
	}

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

	let links: Link[];
	$: links = [
		{
			label: tNav.search(),
			href: appPath("stock"),
			icon: Search
		},
		{
			label: tNav.inventory(),
			href: appPath("inventory"),
			icon: Library
		},
		{
			label: tNav.outbound(),
			href: appPath("outbound"),
			icon: PackageMinus
		},
		{
			label: tNav.settings(),
			href: appPath("settings"),
			icon: Settings
		},
		{
			label: tNav.history(),
			href: appPath("history/date"),
			icon: Book
		},
		{
			label: "Customers",
			href: appPath("customers"),
			icon: PersonStanding
		},
		{
			label: tNav.supplier_orders(),
			href: appPath("supplier_orders"),
			icon: Truck
		}
	];

	$: dbName = $dbNamePersisted;

	const populateDatabase = async function () {
		const { db } = await getInitializedDB(dbName);
		errorMessage = null;
		console.log("Populating database");
		try {
			await upsertBooks(db, dd.books);
			await upsertCustomers(db, dd.customers);
			await upsertSuppliers(db, dd.suppliers);
			await associatePublishers(db, dd.supplierPublishers);
			// possible order lines
			const isbns = dd.customerOrderLines.map((line) => line.isbn);
			await addBooksToCustomer(db, dd.customers[0].id, isbns);

			await createSupplierOrders(db, [
				{ id: 1, supplierId: 1, orderLines: [dd.supplierOrderLines[0]] },
				{ id: 2, supplierId: 2, orderLines: [dd.supplierOrderLines[1]] }
			]);

			await createReconciliationOrders(db, [
				{ id: 1, supplierOrderIds: [1] },
				{ id: 2, supplierOrderIds: [2] }
			]);

			await upsertMultipleReconciliationOrderLines(db, { 1: [dd.reconciliationOrderLines[0]], 2: [dd.reconciliationOrderLines[1]] });
			console.log("Finished populating database.");
		} catch (error) {
			errorMessage = error;
		} finally {
			await loadData();
		}
	};

	const resetDatabase = async function resetDatabase() {
		const db = await getInitializedDB(dbName);
		errorMessage = null;
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
				await db.db.exec(`DELETE FROM ${table}`);
			})
		);
		await loadData();
	};

	const loadData = async function () {
		console.log("Loading database");

		isLoading = true;

		const db = await getInitializedDB(dbName);

		book = await db.db.exec("SELECT COUNT(*) from book;");
		supplier = await db.db.exec("SELECT COUNT(*) from supplier;");
		supplier_publisher = await db.db.exec("SELECT COUNT(*) from supplier_publisher;");
		customer = await db.db.exec("SELECT COUNT(*) from customer;");
		customer_order_lines = await db.db.exec("SELECT COUNT(*) from customer_order_lines;");
		supplier_order = await db.db.exec("SELECT COUNT(*) from supplier_order;");
		supplier_order_line = await db.db.exec("SELECT COUNT(*) from supplier_order_line;");
		reconciliation_order = await db.db.exec("SELECT COUNT(*) from reconciliation_order;");
		reconciliation_order_lines = await db.db.exec("SELECT COUNT(*) from reconciliation_order_lines;");
		isLoading = false;
	};

	async function executeQuery() {
		isLoading = true;
		errorMessage = null;
		const db = await getInitializedDB(dbName);

		try {
			queryResult = await db.db.execO(query);
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
</script>

<div class="flex h-screen w-screen overflow-hidden">
	<!-- Sidenav -->
	<div class="flex">
		<div class="hidden h-screen sm:inline-block">
			<div class="block px-6 py-4">
				<BookCopy color="white" strokeWidth={2} size={36} />
			</div>

			<nav class="px-3" aria-label="Main navigation">
				<ul class="flex flex-col items-center gap-y-3">
					{#each links as { label, icon, href }}
						<TooltipWrapper
							options={{
								positioning: {
									placement: "right"
								},
								openDelay: 0,
								closeDelay: 0,
								closeOnPointerDown: true,
								forceVisible: true
							}}
							let:trigger
						>
							<li {...trigger} use:trigger.action>
								<a {href} class="inline-block rounded-sm p-4 {$page.url.pathname.startsWith(href)}">
									<svelte:component this={icon} size={24} />
								</a>
							</li>

							<p slot="tooltip-content" class="px-4 py-1 text-white">{label}</p>
						</TooltipWrapper>
					{/each}
				</ul>
			</nav>
		</div>
	</div>
	<!-- Sidenav end -->

	<!-- Main content -->
	<div id="content" class="relative flex h-full w-full flex-col overflow-hidden">
		<!-- Main section -->

		<header class="navbar mb-4 bg-neutral">
			<input type="checkbox" value="forest" class="theme-controller toggle" />
		</header>

		<main class="h-screen">
			<div class="relative mx-auto flex h-full flex-col px-4">
				<div class="flex items-center justify-between">
					<h1 class="prose text-2xl font-bold">Debug</h1>
					<div class="gap-2">
						<button class="btn-primary btn" on:click={() => populateDatabase()}>
							<Plus size={20} />
							Populate Database
						</button>
						<button class="btn-primary btn" on:click={() => resetDatabase()}>
							<RotateCcw size={20} />
							Reset Database
						</button>
					</div>
				</div>

				<div class="flex py-2">
					<div class="mr-5 flex-auto overflow-x-auto py-2">
						<h2 class="prose font-bold">Database Query Interface</h2>
						<div class="mr-5 flex flex-col py-2">
							<textarea bind:value={query} id="query"></textarea>

							<button class="btn-sm btn" on:click={executeQuery} disabled={isLoading}>
								<Play size={20} />
								{isLoading ? "Executing..." : "Run Query"}
							</button>

							{#if queryResult || errorMessage}
								<h2 class="prose mt-3 font-bold">Query Results:</h2>

								{#if errorMessage}
									<div class="mt-4 rounded-lg bg-red-500 p-3 text-white shadow">
										{errorMessage}
									</div>
								{:else if queryResult.length === 0}
									<p>No results found.</p>
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
									<th scope="col">Table</th>
									<th scope="col">Number of objects</th>
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

			<div class="flex h-8 items-center justify-end border-t px-4">
				<slot name="footer" />
			</div>
		</main>
		<!-- Main section end -->
	</div>
</div>

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
