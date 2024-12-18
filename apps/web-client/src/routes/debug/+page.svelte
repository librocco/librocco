<script lang="ts">
	import {
		BookCopy,
		Library,
		PackageMinus,
		Search,
		Settings,
		PersonStanding,
		Book,
		Truck,
		Bug
	} from "lucide-svelte";
	import { Plus, RotateCcw } from "lucide-svelte";
	import { LL } from "$i18n/i18n-svelte";
	import { appPath } from "$lib/paths";
	import { TooltipWrapper } from "$lib/components";
	import { onMount } from "svelte";
	import { page } from "$app/stores";
	import { getInitializedDB } from "$lib/db/orders";
	import { upsertBook } from "$lib/db/orders/books";
	import { upsertSupplier } from "$lib/db/orders/suppliers";

	import type { Book as BookType } from "$lib/db/orders/books";
	import type { Supplier } from "$lib/db/orders/types";

	import debugData from "./debug_data.json";

	$: ({ nav: tNav } = $LL);

	interface Link {
		label: string;
		href: string;
		icon: any;
	}

	let books;
	let publishers;
	let customers;
	let orders;
	let suppliers;
	let isLoading = true;

	const tables: string[] = ["book", "supplier_publisher", "supplier", "customer"];
	const tableData = [
		{ label: "Books", value: () => books },
		{ label: "Publishers", value: () => publishers },
		{ label: "Suppliers", value: () => suppliers },
		{ label: "Orders", value: () => orders },
		{ label: "Customers", value: () => customers }
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
		},
		{
			label: tNav.debug(),
			href: appPath("debug"),
			icon: Bug
		}
	];

	const populateBooks = async function (db) {
		console.log("Populating books");
		for (const book of debugData.books) {
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
		for (const supplier of debugData.suppliers) {
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

	const populateDatabase = async function () {
		const db = await getInitializedDB("librocco-current-db");
		console.log("Populating database");
		await populateBooks(db);
		await populateSuppliers(db);
		console.log("Finished populating database.");

		await loadData();
	};

	const resetDatabase = async function resetDatabase() {
		const db = await getInitializedDB("librocco-current-db");
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
		books = await db.exec("SELECT COUNT(*) from book;");
		publishers = await db.exec("SELECT COUNT(*) from supplier_publisher;");
		customers = await db.exec("SELECT COUNT(*) from customer;");
		orders = await db.exec("SELECT COUNT(*) from customer_supplier_order;");
		suppliers = await db.exec("SELECT COUNT(*) from supplier;");

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
			<div class="mx-auto flex h-full max-w-5xl flex-col gap-y-10 px-4">
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

				<div class="flex flex-col gap-y-6 overflow-x-auto py-2">
					<table class="table-lg table">
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
