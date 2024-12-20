<script lang="ts">
	import {
		BookCopy,
		Library,
		PackageMinus,
		Search,
		Settings,
		PersonStanding,
		Book,
		Truck
	} from "lucide-svelte";
	import { Plus, RotateCcw } from "lucide-svelte";
	import { LL } from "$i18n/i18n-svelte";
	import { appPath } from "$lib/paths";
	import { TooltipWrapper } from "$lib/components";
	import { onMount } from "svelte";
	import { page } from "$app/stores";
	import { getInitializedDB } from "$lib/db/orders";

	import exampleData from "./example_data";

	$: ({ nav: tNav } = $LL);

	interface Link {
		label: string;
		href: string;
		icon: any;
	}

	const dataStore = {};

	let book;
	let supplier;
	let supplier_publisher;
	let customer;
	let customer_order_lines;
	let supplier_order;
	let supplier_order_line;
	let customer_supplier_order;
	let reconciliation_order;

	let isLoading = true;

	const tableData = [
		{ label: "Books", value: () => book },
		{ label: "Suppliers", value: () => supplier },
		{ label: "Supplier Publishers", value: () => supplier_publisher },
		{ label: "Customers", value: () => customer },
		{ label: "Customer Order Lines", value: () => customer_order_lines },
		{ label: "Supplier Orders", value: () => supplier_order },
		{ label: "Supplier Order Lines", value: () => supplier_order_line },
		{ label: "Customer Supplier Orders", value: () => customer_supplier_order },
		{ label: "Reconciliation Orders", value: () => reconciliation_order },
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

	const populateBooks = async function (db) {
		console.log("Populating books");
		for (const book of exampleData.book) {
			await db.exec(
				`INSERT INTO book (isbn, title, authors, publisher, price)
				VALUES (?, ?, ?, ?, ?)
				ON CONFLICT(isbn) DO UPDATE SET
					title = COALESCE(?, title),
					authors = COALESCE(?, authors),
					publisher = COALESCE(?, publisher),
					price = COALESCE(?, price);`,
				[book.isbn, book.title, book.authors, book.publisher, book.price, book.title, book.authors, book.publisher, book.price]
			);
			console.log(`Upserted book: ${book.isbn}`);
		}
	}

	const populateSuppliers = async function (db) {
		console.log("Populating suppliers");
		for (const supplier of exampleData.supplier) {
			await db.exec(
				`INSERT INTO supplier (id, name, email, address)
				VALUES (?, ?, ?, ?)
				ON CONFLICT(id) DO UPDATE SET
					name = COALESCE(?, name),
					email = COALESCE(?, email),
					address = COALESCE(?, address);`,
				[
					supplier.id,
					supplier.name ?? null,
					supplier.email ?? null,
					supplier.address ?? null,
					supplier.name ?? null,
					supplier.email ?? null,
					supplier.address ?? null,
				]
			);
			console.log(`Upserted supplier: ${supplier.name}`);
		}
	}

	const populateCustomers = async function (db) {
		console.log("Populating customers");
		for (const customer of exampleData.customer) {
			await db.exec(
				`INSERT INTO customer (id, fullname, email, deposit)
				VALUES (?, ?, ?, ?)
				ON CONFLICT(id) DO UPDATE SET
				fullname = COALESCE(?, fullname),
				email = COALESCE(?, email),
				updatedAt = (strftime('%s', 'now') * 1000),
				deposit = COALESCE(?, deposit);`,
				[
					customer.id,
					customer.fullname ?? null,
					customer.email ?? null,
					customer.deposit ?? null,
					customer.fullname ?? null,
					customer.email ?? null,
					customer.deposit ?? null
				]
			);
			console.log(`Upserted supplier: ${customer.fullname}`);
		}
	}

	const populateDatabase = async function () {
		const db = await getInitializedDB("librocco-current-db");
		console.log("Populating database");
		await db.exec(exampleData);
		console.log("Finished populating database.");
		await loadData();
	};

	const resetDatabase = async function resetDatabase() {
		const db = await getInitializedDB("librocco-current-db");
		const tables = [
			"book",
			"supplier",
			"supplier_publisher",
			"customer",
			"customer_order_lines",
			"supplier_order",
			"supplier_order_line",
			"customer_supplier_order",
			"reconciliation_order"
		]
		console.log("Resetting database");

		await Promise.all(tables.map(async (table) => {
			console.log(`Clearing ${table}`);
			await db.exec(`DELETE FROM ${table}`);
		}));
		await loadData();
	};

	const loadData = async function () {
		console.log("Loading database");

		isLoading = true;

		const db = await getInitializedDB("librocco-current-db");

		book = await db.exec("SELECT COUNT(*) from book;");
		supplier = await db.exec("SELECT COUNT(*) from supplier;");
		supplier_publisher = await db.exec("SELECT COUNT(*) from supplier_publisher;");
		customer = await db.exec("SELECT COUNT(*) from customer;");
		customer_order_lines = await db.exec("SELECT COUNT(*) from customer_order_lines;");
		supplier_order = await db.exec("SELECT COUNT(*) from supplier_order;");
		supplier_order_line = await db.exec("SELECT COUNT(*) from supplier_order_line;");
		customer_supplier_order = await db.exec("SELECT COUNT(*) from customer_supplier_order;");
		reconciliation_order = await db.exec("SELECT COUNT(*) from reconciliation_order;");

		isLoading = false;
	};

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
			<div class="mx-auto relative flex h-full flex-col gap-y-10 px-4">
				<div class="flex items-center justify-between">
					<h1 class="prose font-bold">Debug</h1>
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

				<div class="flex flex-col gap-y-10 overflow-x-auto py-2">
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
		margin: auto;
	}

	@keyframes spin {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}
</style>
